"""Generate the in-app wordmark and desktop app icon from the official LifeScribe logo.

Unlike LifeScribe Vault, Biography doesn't add an app-specific badge to the mark — it uses the
official logo as published on lifescribe.us, just recolored to this app's brand color and
cropped/padded for each use (a wide wordmark for the sidebar header, a square icon for the OS).
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BRANDING = ROOT / "branding"
ASSETS = ROOT / "src" / "assets"
PUBLIC = ROOT / "public"

# Biography's own brand teal (src/styles/globals.css --color-primary), not Vault's.
PRIMARY = "#3D7A8A"
CREAM = "#FAF7F0"


def tinted_logo(source: Image.Image, color: str) -> Image.Image:
    """Turn the site's grayscale-on-white artwork into a tinted alpha image."""
    rgba = source.convert("RGBA")
    luminance = rgba.convert("L")
    # The published PNG has faint near-white compression texture. Discard it,
    # while keeping a narrow antialiasing band around the actual artwork.
    alpha = luminance.point(
        lambda value: 0
        if value >= 225
        else 255
        if value <= 190
        else round((225 - value) * 255 / 35),
    )
    result = Image.new("RGBA", rgba.size, color)
    result.putalpha(alpha)
    return result


def generate_wordmark(source: Image.Image) -> None:
    """The full "LifeScribe" wordmark (book mark + text), tinted, for the sidebar header."""
    logo = tinted_logo(source, PRIMARY)
    bounds = logo.getbbox()
    if bounds is None:
        raise RuntimeError("The LifeScribe source logo contains no visible artwork.")
    logo = logo.crop(bounds)
    ASSETS.mkdir(parents=True, exist_ok=True)
    logo.save(ASSETS / "lifescribe-logo.png", optimize=True)


def generate_app_icon(source: Image.Image) -> None:
    """Just the book/quill mark (no wordmark) on a rounded teal square, for the OS icon."""
    # The mark sits in the left part of the source image; the wordmark text starts further right.
    emblem = tinted_logo(source.crop((0, 0, 415, source.height)), CREAM)
    bounds = emblem.getbbox()
    if bounds is None:
        raise RuntimeError("The LifeScribe emblem crop contains no visible artwork.")
    emblem = emblem.crop(bounds)
    emblem = emblem.resize(
        (720, round(emblem.height * 720 / emblem.width)),
        Image.Resampling.LANCZOS,
    )

    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    from PIL import ImageDraw

    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((32, 32, 992, 992), radius=210, fill=PRIMARY)
    emblem_x = (1024 - emblem.width) // 2
    emblem_y = (1024 - emblem.height) // 2
    canvas.alpha_composite(emblem, (emblem_x, emblem_y))

    BRANDING.mkdir(parents=True, exist_ok=True)
    canvas.save(BRANDING / "lifescribe-biography-app-icon.png", optimize=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    canvas.resize((512, 512), Image.Resampling.LANCZOS).save(
        PUBLIC / "lifescribe-icon.png",
        optimize=True,
    )


def main() -> None:
    source = Image.open(BRANDING / "source-lifescribe-logo.png")
    generate_wordmark(source)
    generate_app_icon(source)
    print("Wrote:")
    print(f"  {ASSETS / 'lifescribe-logo.png'}")
    print(f"  {BRANDING / 'lifescribe-biography-app-icon.png'}")
    print(f"  {PUBLIC / 'lifescribe-icon.png'}")
    print("\nNext: npx tauri icon branding/lifescribe-biography-app-icon.png")


if __name__ == "__main__":
    main()

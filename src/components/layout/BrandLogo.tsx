import logoUrl from "@/assets/lifescribe-logo.png";

export interface BrandLogoProps {
  className?: string;
}

/** The official LifeScribe wordmark (as used on lifescribe.us), tinted to this app's brand color. */
export default function BrandLogo({ className = "" }: BrandLogoProps) {
  return <img src={logoUrl} alt="LifeScribe" className={className} width={1160} height={352} />;
}

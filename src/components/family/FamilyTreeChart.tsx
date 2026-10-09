import { useCallback, useMemo, useState } from "react";
import ReactFamilyTree from "react-family-tree";
import type { Node as FTNode, ExtNode } from "relatives-tree/lib/types";
import { imageSrc } from "@/lib/image-src";
import { formatFamilyName } from "@/lib/reader-utils";
import type { FamilyMember, FamilyRelationship } from "@/lib/models";

const NODE_W = 200;
const NODE_H = 100;
// react-family-tree lays nodes out on a grid of half-width / half-height units.
const HALF_W = NODE_W / 2;
const HALF_H = NODE_H / 2;

/**
 * Build relatives-tree nodes from members + relationships, the same way the web
 * bio does: collect parents/children/siblings/spouses, then infer a second
 * parent from a single parent's spouse so couples render together.
 */
function buildNodes(members: FamilyMember[], rels: FamilyRelationship[]): readonly FTNode[] {
  // relatives-tree uses const enums; the runtime values are plain strings.
  type G = FTNode["gender"];
  type R = FTNode["parents"][number]["type"];
  const blood = "blood" as unknown as R;
  const married = "married" as unknown as R;

  const parentMap = new Map<number, Set<number>>();
  const childMap = new Map<number, Set<number>>();
  const siblingMap = new Map<number, Set<number>>();
  const spouseMap = new Map<number, Set<number>>();
  const ensure = (map: Map<number, Set<number>>, id: number) => {
    let s = map.get(id);
    if (!s) map.set(id, (s = new Set()));
    return s;
  };

  for (const m of members) {
    ensure(parentMap, m.id);
    ensure(childMap, m.id);
    ensure(siblingMap, m.id);
    ensure(spouseMap, m.id);
  }

  const known = new Set(members.map((m) => m.id));
  for (const r of rels) {
    const a = r.from_member_id;
    const b = r.to_member_id;
    if (!known.has(a) || !known.has(b)) continue;
    switch (r.relationship_type) {
      case "parent": // a is a parent of b
        ensure(childMap, a).add(b);
        ensure(parentMap, b).add(a);
        break;
      case "child": // a is a child of b
        ensure(parentMap, a).add(b);
        ensure(childMap, b).add(a);
        break;
      case "sibling":
        ensure(siblingMap, a).add(b);
        ensure(siblingMap, b).add(a);
        break;
      case "spouse":
        ensure(spouseMap, a).add(b);
        ensure(spouseMap, b).add(a);
        break;
    }
  }

  for (const m of members) {
    const parents = parentMap.get(m.id)!;
    if (parents.size === 1) {
      const [only] = parents;
      for (const spouseId of spouseMap.get(only) ?? []) {
        if (!parents.has(spouseId)) {
          parents.add(spouseId);
          ensure(childMap, spouseId).add(m.id);
        }
      }
    }
  }

  return members.map((m): FTNode => ({
    id: String(m.id),
    gender: (m.gender === "female" ? "female" : "male") as unknown as G,
    parents: [...parentMap.get(m.id)!].map((id) => ({ id: String(id), type: blood })),
    children: [...childMap.get(m.id)!].map((id) => ({ id: String(id), type: blood })),
    siblings: [...siblingMap.get(m.id)!].map((id) => ({ id: String(id), type: blood })),
    spouses: [...spouseMap.get(m.id)!].map((id) => ({ id: String(id), type: married })),
  }));
}

/** Members reachable from `startId` through any relationship (what the tree library can draw). */
function findConnectedIds(members: FamilyMember[], rels: FamilyRelationship[], startId: number): Set<number> {
  const adj = new Map<number, Set<number>>(members.map((m) => [m.id, new Set<number>()]));
  for (const r of rels) {
    adj.get(r.from_member_id)?.add(r.to_member_id);
    adj.get(r.to_member_id)?.add(r.from_member_id);
  }
  const seen = new Set<number>();
  const stack = [startId];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const n of adj.get(id) ?? []) if (!seen.has(n)) stack.push(n);
  }
  return seen;
}

function yearOf(date: string | null): string | null {
  return date ? date.substring(0, 4) : null;
}

function dateLabel(m: FamilyMember): string | null {
  const b = yearOf(m.birth_date);
  const d = yearOf(m.death_date);
  if (b) return d ? `${b} – ${d}` : `b. ${b}`;
  return d ? `d. ${d}` : null;
}

function initials(m: FamilyMember): string {
  return ((m.given_name?.[0] ?? "") + (m.surname?.[0] ?? "")).toUpperCase() || "?";
}

const CARD_TONE: Record<string, string> = {
  female: "border-pink-300 bg-pink-50",
  other: "border-[var(--color-border)] bg-[var(--color-surface)]",
  male: "border-sky-300 bg-sky-50",
};
const AVATAR_TONE: Record<string, string> = {
  female: "bg-pink-200 text-pink-800",
  other: "bg-gray-200 text-gray-800",
  male: "bg-sky-200 text-sky-800",
};
const toneKey = (m: FamilyMember) => (m.gender === "female" || m.gender === "other" ? m.gender : "male");

function MemberCardBody({ member }: { member: FamilyMember }) {
  const photo = imageSrc(member.photo_path);
  const label = dateLabel(member);
  return (
    <div className="flex items-center gap-2">
      {photo ? (
        <img src={photo} alt={formatFamilyName(member)} className="h-9 w-9 shrink-0 rounded-full object-cover" />
      ) : (
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${AVATAR_TONE[toneKey(member)]}`}>
          {initials(member)}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900">{formatFamilyName(member)}</p>
        {label && <p className="truncate text-xs" style={{ color: "var(--color-text-secondary)" }}>{label}</p>}
      </div>
    </div>
  );
}

function NodeCard({ node, member, isRoot, onSetRoot }: { node: ExtNode; member: FamilyMember; isRoot: boolean; onSetRoot: (id: number) => void }) {
  return (
    <div
      style={{
        position: "absolute",
        left: node.left * HALF_W,
        top: node.top * HALF_H,
        width: NODE_W,
        height: NODE_H,
        padding: 4,
        boxSizing: "border-box",
      }}
    >
      <div
        className={`flex h-full w-full cursor-pointer flex-col justify-center rounded-lg border-2 px-3 py-2 shadow-sm transition-all hover:shadow-md ${CARD_TONE[toneKey(member)]} ${isRoot ? "ring-2 ring-offset-1" : ""}`}
        style={isRoot ? ({ "--tw-ring-color": "var(--color-accent)" } as React.CSSProperties) : undefined}
        onClick={() => onSetRoot(member.id)}
        title="Click to center tree on this person"
      >
        <MemberCardBody member={member} />
      </div>
    </div>
  );
}


interface FamilyTreeChartProps {
  members: FamilyMember[];
  rels: FamilyRelationship[];
  /** Person to center on first; defaults to the first member. */
  initialRootId?: number;
}

/** The interactive family chart (same as the public site): pick a person to center on, click a card to re-center. */
export default function FamilyTreeChart({ members, rels, initialRootId }: FamilyTreeChartProps) {
  const [rootId, setRootId] = useState<number>(initialRootId ?? members[0]?.id ?? 0);
  const nodes = useMemo(() => buildNodes(members, rels), [members, rels]);
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const handleSetRoot = useCallback((id: number) => setRootId(id), []);

  // If the chosen person was deleted, fall back to the first member.
  const effectiveRoot = memberMap.has(rootId) ? rootId : (members[0]?.id ?? 0);
  if (members.length === 0) return null;

  const connected = findConnectedIds(members, rels, effectiveRoot);
  const unconnected = members.filter((m) => !connected.has(m.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>Center on:</label>
        <select
          value={effectiveRoot}
          onChange={(e) => setRootId(Number(e.target.value))}
          className="rounded-md border px-3 py-1.5 text-sm shadow-sm"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>{formatFamilyName(m)}</option>
          ))}
        </select>
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Click any card to recenter</span>
      </div>

      <div className="overflow-x-auto">
        <div style={{ position: "relative", display: "inline-block", minWidth: "100%" }}>
          <ReactFamilyTree
            nodes={nodes}
            rootId={String(effectiveRoot)}
            width={NODE_W}
            height={NODE_H}
            renderNode={(node: ExtNode) => {
              const member = memberMap.get(Number(node.id));
              if (!member) return null;
              return (
                <NodeCard key={node.id} node={node} member={member} isRoot={member.id === effectiveRoot} onSetRoot={handleSetRoot} />
              );
            }}
          />
        </div>
      </div>

      {unconnected.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-3 text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
            Not yet connected to tree
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {unconnected.map((m) => (
              <div
                key={m.id}
                className={`cursor-pointer rounded-lg border-2 px-3 py-2 shadow-sm transition-all hover:shadow-md ${CARD_TONE[toneKey(m)]}`}
                onClick={() => setRootId(m.id)}
                title="Click to center tree on this person"
              >
                <MemberCardBody member={m} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs" style={{ color: "var(--color-text-secondary)" }}>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border-2 border-sky-300 bg-sky-50" />Male</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border-2 border-pink-300 bg-pink-50" />Female</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border-2" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }} />Other</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border-2" style={{ borderColor: "var(--color-accent)" }} />Root person</span>
      </div>
    </div>
  );
}

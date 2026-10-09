import PageHeader from "@/components/ui/PageHeader";
import CategoryManager from "@/components/organize/CategoryManager";
import TagManager from "@/components/organize/TagManager";

export default function OrganizePage() {
  return (
    <div className="p-8">
      <PageHeader title="Categories & Tags" subtitle="Keep your stories, photos and memories organized" />
      <div className="grid gap-6 lg:grid-cols-2 max-w-5xl">
        <CategoryManager />
        <TagManager />
      </div>
    </div>
  );
}

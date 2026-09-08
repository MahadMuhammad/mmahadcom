import { Tabs, TabsContent, TabsList, TabsTrigger } from "fumadocs-ui/components/tabs";

interface Props {
  label: string;
  panels: { label: string; html: string }[];
}

export function NotesTabs({ label, panels }: Props) {
  return (
    <Tabs defaultValue={panels[0].label}>
      <TabsList aria-label={label}>
        {panels.map((panel) => (
          <TabsTrigger key={panel.label} value={panel.label}>
            {panel.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {panels.map((panel) => (
        <TabsContent key={panel.label} value={panel.label}>
          {/* HTML comes only from Astro-rendered, repository-owned MDX slots. */}
          <div dangerouslySetInnerHTML={{ __html: panel.html }} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

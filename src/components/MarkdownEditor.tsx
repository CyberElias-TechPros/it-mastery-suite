import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import MarkdownRenderer from "./MarkdownRenderer";
import { Bold, Italic, List, ListOrdered, Code, Link, Image, Heading1, Heading2, Quote } from "lucide-react";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
}

export default function MarkdownEditor({ 
  value, 
  onChange, 
  placeholder = "Write your content here...",
  height = 300 
}: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");

  const insertMarkdown = (before: string, after: string = "", placeholder: string = "") => {
    const textarea = document.querySelector('textarea[data-markdown-editor]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const textToInsert = selectedText || placeholder;
    
    const newValue = 
      value.substring(0, start) + 
      before + textToInsert + after + 
      value.substring(end);
    
    onChange(newValue);
    
    // Set cursor position after insertion
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + textToInsert.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const toolbarActions = [
    { icon: Bold, action: () => insertMarkdown("**", "**", "bold text"), label: "Bold" },
    { icon: Italic, action: () => insertMarkdown("*", "*", "italic text"), label: "Italic" },
    { icon: Heading1, action: () => insertMarkdown("# ", "", "Heading 1"), label: "Heading 1" },
    { icon: Heading2, action: () => insertMarkdown("## ", "", "Heading 2"), label: "Heading 2" },
    { icon: List, action: () => insertMarkdown("- ", "", "list item"), label: "Bullet List" },
    { icon: ListOrdered, action: () => insertMarkdown("1. ", "", "list item"), label: "Numbered List" },
    { icon: Quote, action: () => insertMarkdown("> ", "", "quote"), label: "Quote" },
    { icon: Code, action: () => insertMarkdown("`", "`", "code"), label: "Inline Code" },
    { icon: Link, action: () => insertMarkdown("[", "](url)", "link text"), label: "Link" },
    { icon: Image, action: () => insertMarkdown("![alt text](", ")", "image-url"), label: "Image" },
  ];

  return (
    <div className="border rounded-lg overflow-hidden">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "write" | "preview")}>
        <div className="flex items-center justify-between border-b bg-muted/50 px-2">
          <div className="flex items-center gap-1 py-1">
            {toolbarActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={action.action}
                  title={action.label}
                  disabled={activeTab === "preview"}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              );
            })}
          </div>
          <TabsList className="h-8 bg-transparent">
            <TabsTrigger value="write" className="text-xs">Write</TabsTrigger>
            <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="write" className="m-0">
          <Textarea
            data-markdown-editor
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="border-0 rounded-none resize-none focus-visible:ring-0"
            style={{ minHeight: height }}
          />
        </TabsContent>

        <TabsContent value="preview" className="m-0">
          <div 
            className="p-4 overflow-auto bg-background"
            style={{ minHeight: height }}
          >
            {value ? (
              <MarkdownRenderer content={value} />
            ) : (
              <p className="text-muted-foreground italic">Nothing to preview</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import ReactMarkdown from "react-markdown";

export default function CmsContent({ content, fallback = null, className = "" }) {
  if (!content) return fallback;
  return (
    <div className={`prose prose-slate max-w-none ${className}`}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
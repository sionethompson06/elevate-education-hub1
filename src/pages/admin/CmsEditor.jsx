import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Globe, HelpCircle, DollarSign, BookOpen, CheckCircle, Clock, Archive } from "lucide-react";
import CmsEntityTable from "@/components/admin/cms/CmsEntityTable";

const TABS = [
  { key: "CmsPage", label: "Pages", icon: FileText },
  { key: "CmsProgram", label: "Programs", icon: BookOpen },
  { key: "CmsPricingPlan", label: "Pricing Plans", icon: DollarSign },
  { key: "CmsFaqItem", label: "FAQ Items", icon: HelpCircle },
  { key: "CmsPolicySection", label: "Policy Sections", icon: Globe },
];

export default function CmsEditor() {
  const [activeTab, setActiveTab] = useState("CmsPage");

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold mb-2">Admin</div>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">CMS Editor</h1>
        <p className="text-slate-500 mt-1">Manage all public-facing content.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? "bg-[#1a3c5e] text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:border-[#1a3c5e]"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <CmsEntityTable entityName={activeTab} />
    </div>
  );
}
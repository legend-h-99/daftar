"use client";

"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import PurchaseForm from "@/components/PurchaseForm";
import { useLanguage } from "@/lib/language";

export default function NewPurchasePage() {
  const { language } = useLanguage();
  const en = language === "en";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link
          href="/purchases"
          aria-label={en ? "Back" : "رجوع"}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600"
        >
          {en ? <ArrowLeft className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">{en ? "New purchase" : "شراء جديد"}</h1>
          <p className="text-xs text-gray-500">
            {en ? "Every purchased item is automatically added to your stock" : "كل صنف تشتريه ينضاف لمخزونك تلقائيًا"}
          </p>
        </div>
      </div>
      <PurchaseForm source="MANUAL" />
    </div>
  );
}

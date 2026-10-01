"use client";

import ProductForm from "@/components/ProductForm";
import { useLanguage } from "@/lib/language";

export default function NewProductPage() {
  const { language } = useLanguage();
  const en = language === "en";
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">
          {en ? "Product cost calculator" : "حاسبة تكلفة المنتج"}
        </h1>
        <p className="text-sm text-gray-500">
          {en ? "Add product ingredients and calculate a suitable selling price" : "أضف مكونات منتجك واحسب سعر بيعه المناسب"}
        </p>
      </div>
      <ProductForm />
    </div>
  );
}

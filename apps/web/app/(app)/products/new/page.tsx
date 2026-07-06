import ProductForm from "@/components/ProductForm";

export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">
          حاسبة تكلفة المنتج
        </h1>
        <p className="text-sm text-gray-500">
          أضف مكونات منتجك واحسب سعر بيعه المناسب
        </p>
      </div>
      <ProductForm />
    </div>
  );
}

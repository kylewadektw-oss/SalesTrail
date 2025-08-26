import React from "react";

type Sale = {
  id: string;
  title: string;
  description: string;
  url: string;
  start_date: string;
};

export default function SaleCard({ sale }: { sale: Sale }) {
  return (
    <div className="border rounded p-4 bg-white shadow-sm">
      <h3 className="font-semibold text-lg mb-1">
        <a href={sale.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {sale.title}
        </a>
      </h3>
      <p className="text-sm text-gray-600 mb-1">{sale.start_date}</p>
      <p className="text-gray-700 text-sm mb-2">{sale.description}</p>
    </div>
  );
}

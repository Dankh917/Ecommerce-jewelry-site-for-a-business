import { Link } from "react-router-dom";
import type { JewelryItemForCard } from "../types/JewelryItemForCard";

export default function JewelryCard({ item }: { item: JewelryItemForCard }) {
    const price = Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(item.price);

    return (
        <Link
            to={`/item/${item.id}`}
            className="group block no-underline text-inherit h-full"
        >
            <div
                className="
          h-full max-w-xs mx-auto rounded-2xl overflow-hidden
          ring-1 ring-black/5 shadow-sm
          transition
          duration-200
          ease-out
          group-hover:shadow-lg group-hover:-translate-y-0.5
          focus-within:shadow-lg
          focus-within:-translate-y-0.5
          focus-within:ring-2 focus-within:ring-[#6B8C8E]/40
        "
                style={{ backgroundColor: "#f3f6f7" }}
            >
                <figure className="relative w-full h-48 overflow-hidden">
                    <img
                        src={item.mainImageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                    />

                    {item.collection && (
                        <span className="badge badge-neutral absolute left-2 top-2">
                            {item.collection}
                        </span>
                    )}

                    {!item.isAvailable && (
                        <span className="badge badge-error absolute right-2 top-2">
                            Out
                        </span>
                    )}
                </figure>

                <div className="p-4 flex flex-col">
                    <h3 className="text-lg font-bold leading-snug line-clamp-2 min-h-[3.25rem]">
                        {item.name}
                    </h3>

                    <div className="mt-auto flex justify-end">
                        <span className="text-xl font-semibold">{price}</span>
                    </div>
                </div>
            </div>
        </Link>
    );
}

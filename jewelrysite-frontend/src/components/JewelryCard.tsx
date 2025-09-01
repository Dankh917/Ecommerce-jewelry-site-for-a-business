import { Link } from "react-router-dom";
import type { JewelryItemForCard } from "../types/JewelryItemForCard";

export default function JewelryCard({ item }: { item: JewelryItemForCard }) {
    const price = Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.price);

    return (
        <Link to={`/item/${item.id}`} className="block no-underline text-inherit h-full">
            <div
                className="card shadow-md hover:shadow-xl transition hover:-translate-y-0.5 h-full max-w-xs mx-auto"
                style={{ backgroundColor: "#fbfbfa" }}
            >
                <figure className="relative w-full h-48 overflow-hidden">
                    <img
                        src={item.mainImageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                    {item.collection && (
                        <span className="badge badge-neutral absolute left-2 top-2">{item.collection}</span>
                    )}
                    {!item.isAvailable && (
                        <span className="badge badge-error absolute right-2 top-2">Out</span>
                    )}
                </figure>
                <div className="card-body p-4 flex flex-col">
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

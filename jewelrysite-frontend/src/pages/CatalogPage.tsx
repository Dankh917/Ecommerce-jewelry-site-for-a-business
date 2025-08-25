import { useEffect, useState } from "react";
import { getCatalog } from "../api/jewelry";

export default function CatalogPage() {
    const [items, setItems] = useState<any[]>([]);
    useEffect(() => {
        (async () => {
            const data = await getCatalog();
            console.log("catalog", data);
            setItems(data);
        })();
    }, []);
    return <main style={{ padding: 16 }}><pre>{JSON.stringify(items, null, 2)}</pre></main>;
}

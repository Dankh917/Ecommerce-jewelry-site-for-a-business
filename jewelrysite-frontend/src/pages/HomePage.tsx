import Header from "../components/Header";

export default function HomePage() {
    return (
        <div className="min-h-screen p-6 bg-[#fbfbfa]">
            <Header />
            <main className="p-6">
                <div className="m-4 p-4 rounded-xl bg-blue-600 text-white">
                    Tailwind OK
                </div>
            </main>
        </div>
    );
}

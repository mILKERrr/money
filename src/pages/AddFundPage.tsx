import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Search } from "lucide-react";
import { searchFund } from "@/lib/api";
import { useHoldingsStore } from "@/store/holdingsStore";
import { HoldingEditor } from "@/components/HoldingEditor";
import type { FundInfo } from "@/types/fund";

export function AddFundPage() {
  const { fundCode: existingCode } = useParams();
  const navigate = useNavigate();
  const addHolding = useHoldingsStore((s) => s.addHolding);

  const [keyword, setKeyword] = useState(existingCode ?? "");
  const [results, setResults] = useState<FundInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<FundInfo | null>(null);

  async function handleSearch() {
    const q = keyword.trim();
    if (!q) return;
    setLoading(true);
    try {
      const list = await searchFund(q);
      setResults(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleSave(data: { shares: number; costPrice: number }) {
    if (!selected) return;
    addHolding({
      fundCode: selected.code,
      fundName: selected.name,
      ...data
    });
    navigate("/");
  }

  return (
    <div className="min-h-full bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-3 py-2 flex items-center gap-2 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg active:bg-gray-100">
          <ChevronLeft size={22} />
        </button>
        <input
          autoFocus
          placeholder="输入基金代码（如 161725）"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-base focus:outline-none"
          inputMode="numeric"
          pattern="[0-9]*"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="p-2 rounded-lg bg-brand-500 text-white disabled:opacity-50"
        >
          <Search size={20} />
        </button>
      </header>

      <main className="p-4 space-y-2">
        {results.map((f) => (
          <button
            key={f.code}
            onClick={() => setSelected(f)}
            className="card w-full text-left flex items-center justify-between active:bg-gray-50"
          >
            <div>
              <div className="font-medium text-gray-900">{f.name}</div>
              <div className="text-xs text-gray-500 font-mono mt-0.5">{f.code}</div>
            </div>
            <span className="text-brand-500 text-sm">添加</span>
          </button>
        ))}

        {!loading && results.length === 0 && keyword && (
          <div className="text-center text-gray-400 py-12 text-sm">
            没有匹配的基金
          </div>
        )}

        {loading && (
          <div className="text-center text-gray-400 py-12 text-sm">搜索中...</div>
        )}
      </main>

      {selected && (
        <HoldingEditor
          fundCode={selected.code}
          fundName={selected.name}
          onSave={handleSave}
          onCancel={() => setSelected(null)}
        />
      )}
    </div>
  );
}

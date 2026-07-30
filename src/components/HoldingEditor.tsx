import { useState } from "react";
import { X, Check } from "lucide-react";
import type { Holding } from "@/types/fund";

interface Props {
  fundCode: string;
  fundName: string;
  initial?: Holding;
  onSave: (data: { shares: number; costPrice: number }) => void;
  onCancel: () => void;
}

export function HoldingEditor({ fundCode, fundName, initial, onSave, onCancel }: Props) {
  const [shares, setShares] = useState(initial?.shares.toString() ?? "");
  const [costPrice, setCostPrice] = useState(initial?.costPrice.toString() ?? "");

  const valid =
    shares.trim() !== "" &&
    costPrice.trim() !== "" &&
    Number(shares) > 0 &&
    Number(costPrice) > 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
      <div className="bg-white w-full max-w-md rounded-t-2xl p-5 pb-8 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">编辑持仓</h2>
          <button onClick={onCancel} className="p-1 rounded-lg active:bg-gray-100">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="mb-3 text-sm text-gray-500">
          {fundName} <span className="font-mono">{fundCode}</span>
        </div>

        <label className="block mb-3">
          <span className="text-sm text-gray-600">持有份额</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="如 1000"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            className="input mt-1"
          />
        </label>

        <label className="block mb-5">
          <span className="text-sm text-gray-600">成本净值</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.0001"
            placeholder="如 1.2345"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            className="input mt-1"
          />
        </label>

        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-ghost flex-1">
            取消
          </button>
          <button
            disabled={!valid}
            onClick={() => onSave({ shares: Number(shares), costPrice: Number(costPrice) })}
            className="btn-primary flex-1 flex items-center justify-center gap-1"
          >
            <Check size={18} /> 保存
          </button>
        </div>
      </div>
    </div>
  );
}

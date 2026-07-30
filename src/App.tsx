import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Home, Star, BarChart3, User } from "lucide-react";
import { HomePage } from "@/pages/HomePage";
import { AddFundPage } from "@/pages/AddFundPage";
import { FundDetailPage } from "@/pages/FundDetailPage";
import clsx from "clsx";

function BottomTabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { key: "home", icon: Home, label: "首页", path: "/" },
    { key: "watch", icon: Star, label: "自选", path: "/watch" },
    { key: "market", icon: BarChart3, label: "行情", path: "/market" },
    { key: "me", icon: User, label: "我的", path: "/me" }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 z-20 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around py-1.5">
        {tabs.map((t) => {
          const active = t.path === "/" ? location.pathname === "/" : location.pathname.startsWith(t.path);
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => {
                if (t.path !== "/") {
                  navigate("/");
                } else {
                  navigate(t.path);
                }
              }}
              className={clsx(
                "flex flex-col items-center gap-0.5 px-3 py-1",
                active ? "text-brand-500" : "text-gray-500"
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              <span className={clsx("text-[10px]", active && "font-medium")}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="min-h-full flex items-center justify-center pb-24">
      <div className="text-center">
        <p className="text-gray-400 text-sm">{title}</p>
        <p className="text-gray-300 text-xs mt-2">即将上线</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-md mx-auto min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/add" element={<AddFundPage />} />
          <Route path="/fund/:fundCode" element={<FundDetailPage />} />
          <Route path="/watch" element={<PlaceholderPage title="自选" />} />
          <Route path="/market" element={<PlaceholderPage title="行情" />} />
          <Route path="/me" element={<PlaceholderPage title="我的" />} />
        </Routes>
        <BottomTabBar />
      </div>
    </BrowserRouter>
  );
}
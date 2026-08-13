import { ArrowRight, ShieldCheck, ShoppingCart, Trash2, UserCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "../../auth/UserContext";
import { useFrameworkWorkspace } from "../../framework/FrameworkWorkspaceContext";
import { canManageWorkspace } from "../../auth/session";

export default function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useUser();
  const { activeFramework, selectedFrameworks, cartFrameworks, cartCount, isCartOpen, setIsCartOpen, removeFromCart, clearCart, checkoutCart } = useFrameworkWorkspace();
  const [showProfile, setShowProfile] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [cartError, setCartError] = useState("");
  const profileMenuRef = useRef(null);
  const cartMenuRef = useRef(null);

  useEffect(() => {
    if (!showProfile) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) setShowProfile(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setShowProfile(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [showProfile]);

  useEffect(() => {
    if (!isCartOpen) return undefined;
    const close = event => { if (!cartMenuRef.current?.contains(event.target)) setIsCartOpen(false); };
    const escape = event => { if (event.key === "Escape") setIsCartOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [isCartOpen, setIsCartOpen]);

  const proceedToCheckout = async () => {
    setCheckingOut(true); setCartError("");
    try { await checkoutCart(); }
    catch (reason) { setCartError(reason.message || "Checkout failed."); }
    finally { setCheckingOut(false); }
  };

  const handleLogout = () => {
    logout();
    setShowProfile(false);
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-[#fffdf8]/76 px-5 py-4 shadow-lg shadow-slate-900/5 backdrop-blur-2xl sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900">
            Compliance workspace
          </p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {location.pathname === "/dashboard" && selectedFrameworks.length
              ? `${selectedFrameworks.length} frameworks combined`
              : activeFramework ? `${activeFramework.name} workspace` : "No framework selected"}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {canManageWorkspace(user?.role) && user?.onboardingComplete && user?.organizationId && <div className="relative" ref={cartMenuRef}>
            <button type="button" onClick={() => { setIsCartOpen(value => !value); setShowProfile(false); }} className="relative inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md" aria-label={`Framework cart with ${cartCount} items`}>
              <ShoppingCart size={20}/><span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && <span className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-blue-700 px-1 text-xs font-black text-white">{cartCount}</span>}
            </button>
            {isCartOpen && <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(23rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_70px_-20px_rgba(15,23,42,0.35)]">
              <div className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-white px-4 py-3.5"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-800"><ShoppingCart size={18}/></span><div><h2 className="text-sm font-black text-slate-950">Framework cart</h2><p className="mt-0.5 text-xs font-medium text-slate-500">{cartCount ? `${cartCount} ${cartCount === 1 ? "framework" : "frameworks"} ready for checkout` : "Choose frameworks to get started"}</p></div></div><button type="button" onClick={() => setIsCartOpen(false)} className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-700" aria-label="Close cart"><X size={17}/></button></div>
              <div className="max-h-72 overflow-y-auto border-y border-slate-100 p-3">{cartFrameworks.length ? <div className="space-y-2">{cartFrameworks.map(framework => <div key={framework.id} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-amber-200 hover:bg-amber-50/40"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700"><ShieldCheck size={17}/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-900">{framework.name}</p><p className="mt-0.5 truncate text-xs text-slate-500">Compliance workspace</p></div><button type="button" onClick={() => removeFromCart(framework.id)} className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${framework.name} from cart`}><Trash2 size={16}/></button></div>)}</div> : <div className="py-9 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-50 text-slate-300"><ShoppingCart size={22}/></span><p className="mt-3 text-sm font-black text-slate-800">Your cart is empty</p><p className="mx-auto mt-1 max-w-52 text-xs leading-5 text-slate-500">Add a framework to review it here before checkout.</p></div>}</div>
              {cartError && <p className="mx-4 mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{cartError}</p>}
              <div className="space-y-2.5 p-3.5"><button type="button" onClick={proceedToCheckout} disabled={!cartCount || checkingOut} className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">{checkingOut ? "Processing..." : "Proceed to checkout"}<ArrowRight size={16}/></button><div className="flex items-center justify-between px-1"><button type="button" onClick={() => setIsCartOpen(false)} className="text-xs font-bold text-slate-600 hover:text-slate-950">Continue adding</button>{cartCount > 0 && <button type="button" onClick={clearCart} className="text-xs font-bold text-rose-600 hover:text-rose-700">Clear cart</button>}</div></div>
            </div>}
          </div>}
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => { setShowProfile((value) => !value); setIsCartOpen(false); }}
              className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-3 text-slate-900 transition hover:bg-white/62"
            >
              <UserCircle size={30} />
              <div className="hidden text-left sm:block">
                <p className="text-sm font-black leading-tight">{user?.name || "User"}</p>
                <p className="text-xs text-slate-500">{user?.organizationName || "Organization"}</p>
              </div>
            </button>

            {showProfile && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white py-2 shadow-2xl shadow-slate-900/15">
                <Link
                  to="/profile"
                  className="block px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-800"
                >
                  My Profile
                </Link>
                <Link
                  to="/profile-settings"
                  className="block px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-800"
                >
                  Profile Settings
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="block px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

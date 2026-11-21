import React from "react";
import { useFirebase } from "../context/FirebaseContext";
import { Cloud, CloudCheck, CloudOff, RefreshCw } from "lucide-react";

export const FirebaseSyncButton: React.FC = () => {
  const { user, isSyncing, syncStatus, setSyncModalOpen } = useFirebase();

  return (
    <button
      id="btn-firebase-sync-header"
      onClick={() => setSyncModalOpen(true)}
      className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-2xs group relative bg-amber-50/60 hover:bg-amber-100/80 text-amber-900 border-amber-200/90"
      title="Firebase Cloud Database & Sync"
    >
      {isSyncing ? (
        <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
      ) : user ? (
        <div className="relative">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="w-4 h-4 rounded-full object-cover border border-amber-300"
            />
          ) : (
            <CloudCheck className="w-3.5 h-3.5 text-emerald-600" />
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full ring-1 ring-white" />
        </div>
      ) : syncStatus === "connected" ? (
        <Cloud className="w-3.5 h-3.5 text-amber-600" />
      ) : (
        <CloudOff className="w-3.5 h-3.5 text-slate-400" />
      )}

      <span className="hidden sm:inline font-bold">
        {user ? (
          <span className="text-amber-950 font-medium truncate max-w-[100px] inline-block align-bottom">
            {user.displayName?.split(" ")[0] || "Cloud"}
          </span>
        ) : (
          "Firebase"
        )}
      </span>

      {/* Cloud Indicator dot */}
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          isSyncing
            ? "bg-blue-500 animate-ping"
            : user
            ? "bg-emerald-500"
            : "bg-amber-500"
        }`}
      />
    </button>
  );
};

import { useState, useMemo } from "react";
import { MessageSquare, Send, X, Trash2 } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import { useUser } from "../auth/UserContext";
import { useComplianceState } from "../compliance/ComplianceStateContext";
import ActiveFrameworkRequired from "../framework/ActiveFrameworkRequired";
import { useFrameworkWorkspace } from "../framework/FrameworkWorkspaceContext";

export default function Comments() {
  const { activeFramework } = useFrameworkWorkspace();

  if (!activeFramework) {
    return <ActiveFrameworkRequired />;
  }

  return <CommentsContent key={activeFramework.id} />;
}

function CommentsContent() {
  const { user } = useUser();
  const { workspaceData, actions } = useComplianceState();
  const [activeTab, setActiveTab] = useState("All");
  const [selectedCommentId, setSelectedCommentId] = useState(null);
  const [replyText, setReplyText] = useState("");

  // Resolve active author from database
  const activeUser = useMemo(() => user?.name || "User", [user]);

  // Gather all comments from workspaceData
  const allComments = useMemo(() => {
    const list = [];
    Object.entries(workspaceData).forEach(([itemId, itemState]) => {
      if (itemState.comments && Array.isArray(itemState.comments)) {
        itemState.comments.forEach((c) => {
          const isObj = typeof c === "object" && c !== null;
          list.push({
            id: isObj ? c.id : `workspace-${itemId}-${Date.now()}`,
            itemId,
            itemTitle: itemId.replace("TEST-", "Test ").replace("RSK-", "Risk ").replace("CTL-", "Control "),
            user: isObj ? c.user : "Admin",
            timestamp: isObj ? c.timestamp : "Just now",
            badge: isObj ? "Custom Comment" : "Comment",
            badgeType: "purple",
            text: isObj ? c.text : String(c),
          });
        });
      }
    });
    return list;
  }, [workspaceData]);

  // Derived filter categories
  const filteredLists = useMemo(() => {
    const assigned = allComments.filter((c) => {
      const itemState = workspaceData[c.itemId] || {};
      const owner = itemState.assignments?.owner || itemState.owner;
      const reviewer = itemState.assignments?.reviewer;
      const approver = itemState.assignments?.approver;
      return owner === activeUser || reviewer === activeUser || approver === activeUser;
    });

    const created = allComments.filter((c) => c.user === activeUser);

    const auditor = allComments.filter((c) =>
      c.user?.toLowerCase().includes("auditor") ||
      c.text?.toLowerCase().includes("auditor")
    );

    const action = allComments.filter((c) =>
      c.text?.toLowerCase().match(/(todo|fix|need|upload|update|reassign|verify|check)/)
    );

    return {
      All: allComments,
      Assigned: assigned,
      Created: created,
      Auditor: auditor,
      Action: action,
    };
  }, [allComments, workspaceData, activeUser]);

  const displayedComments = filteredLists[activeTab] || allComments;

  // Find selected comment inside all list
  const selectedComment = allComments.find((c) => c.id === selectedCommentId);

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedComment) return;

    const targetId = selectedComment.itemId;
    const currentState = workspaceData[targetId] ?? {};

    const newReply = {
      id: `reply-${Date.now()}`,
      user: activeUser,
      text: replyText.trim(),
      timestamp: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    };

    const updatedComments = [...(currentState.comments ?? []), newReply];

    actions.saveComplianceItem(targetId, {
      ...currentState,
      comments: updatedComments,
    });

    setReplyText("");
  };

  const handleDeleteComment = (commentId, itemId) => {
    const currentState = workspaceData[itemId] ?? {};
    if (!currentState.comments) return;

    const updatedComments = currentState.comments.filter((c) => {
      const idToCheck = typeof c === "object" && c !== null ? c.id : null;
      return idToCheck !== commentId;
    });

    actions.saveComplianceItem(itemId, {
      ...currentState,
      comments: updatedComments,
    });

    if (selectedCommentId === commentId) {
      setSelectedCommentId(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900">Comments</h1>
        </div>

        {/* Tabs Bar */}
        <div className="border-b border-slate-200">
          <div className="flex gap-6 overflow-x-auto min-w-max pb-px">
            {[
              { id: "All", label: `All (${filteredLists.All.length})` },
              { id: "Assigned", label: `Assigned to You (${filteredLists.Assigned.length})` },
              { id: "Created", label: `Created by You (${filteredLists.Created.length})` },
              { id: "Auditor", label: `Auditor's comments (${filteredLists.Auditor.length})` },
              { id: "Action", label: `With action (${filteredLists.Action.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedCommentId(null);
                }}
                className={`pb-3 text-sm font-black transition border-b-2 ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Split Screen Layout */}
        <div className="grid gap-4 md:grid-cols-[380px_1fr] items-start">
          {/* Left Column: Comments List */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-950 max-h-[calc(100vh-14rem)] overflow-y-auto min-h-[300px]">
            {displayedComments.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayedComments.map((c) => {
                  const isSelected = selectedCommentId === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCommentId(c.id)}
                      className={`p-4 cursor-pointer transition hover:bg-slate-50/50 ${
                        isSelected ? "bg-blue-50/20 dark:bg-slate-800/30" : ""
                      }`}
                    >
                      <div className="flex justify-between items-start text-xs text-slate-400 font-semibold mb-1">
                        <span>{c.itemTitle}</span>
                        <span>{c.timestamp}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{c.user}</p>

                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                          c.badgeType === "purple" ? "bg-purple-50 text-purple-700" : "bg-amber-50 text-amber-700"
                        }`}>
                          {c.badge}
                        </span>
                      </div>

                      <p className="mt-2 text-xs leading-5 text-slate-500 line-clamp-2">
                        {c.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 font-semibold text-sm">
                No comments found in this tab.
              </div>
            )}
          </div>

          {/* Right Column: Detail / Discussion View */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm min-h-[480px] flex flex-col justify-between dark:border-slate-800 dark:bg-slate-950">
            {selectedComment ? (
              <div className="flex-1 flex flex-col justify-between h-full space-y-6">
                <div className="space-y-4">
                  {/* Topic Header */}
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4 dark:border-slate-800">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                        Conversation Context
                      </span>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                        {selectedComment.itemTitle}
                      </h3>
                    </div>
                    <button
                      onClick={() => setSelectedCommentId(null)}
                      className="rounded-lg p-1 hover:bg-slate-50 text-slate-400"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Primary Message Card */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-700 uppercase">
                          {selectedComment.user[0]}
                        </span>
                        <div>
                          <p className="text-xs font-black text-slate-900">{selectedComment.user}</p>
                          <p className="text-[10px] font-semibold text-slate-400">{selectedComment.timestamp}</p>
                        </div>
                      </div>
                      <button
                        title="Delete Comment"
                        onClick={() => handleDeleteComment(selectedComment.id, selectedComment.itemId)}
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-xs leading-5 font-semibold text-slate-700">
                      {selectedComment.text}
                    </p>
                  </div>

                  {/* Replies Thread */}
                  {workspaceData[selectedComment.itemId]?.comments && (
                    <div className="space-y-3 pt-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Replies</p>
                      {workspaceData[selectedComment.itemId].comments
                        .filter((rep) => rep.id !== selectedComment.id)
                        .map((rep, idx) => (
                          <div key={idx} className="rounded-lg border border-slate-200 bg-white p-4 space-y-2.5 pl-6">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-black text-slate-700 uppercase">
                                  {rep.user ? rep.user[0] : "A"}
                                </span>
                                <div>
                                  <p className="text-xs font-black text-slate-900">{rep.user || "Admin"}</p>
                                  <p className="text-[10px] font-semibold text-slate-400">{rep.timestamp || "Just now"}</p>
                                </div>
                              </div>
                              <button
                                title="Delete Reply"
                                onClick={() => handleDeleteComment(rep.id || rep, selectedComment.itemId)}
                                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            <p className="text-xs leading-5 font-semibold text-slate-600">
                              {rep.text || rep}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Reply Form */}
                <form onSubmit={handleSendReply} className="border-t border-slate-100 pt-4 dark:border-slate-800 space-y-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type a reply..."
                    className="w-full min-h-20 rounded-lg border border-slate-200 p-3 text-sm text-slate-800 outline-none focus:border-blue-500"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex h-9 px-4 items-center gap-2 rounded-lg bg-blue-600 text-white font-bold text-xs transition hover:bg-blue-700"
                    >
                      <Send size={14} />
                      Reply
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20 text-slate-400">
                <MessageSquare size={48} className="text-slate-300 mb-3" />
                <p className="text-sm font-semibold">Select a comment to view the conversation</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

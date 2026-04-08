import { allQuests } from "@/lib/mockData";
import QuestCard from "@/components/QuestCard";

const QuestsPage = () => {
  const active = allQuests.filter((q) => q.status === "active");
  const pending = allQuests.filter((q) => q.status === "pending");
  const complete = allQuests.filter((q) => q.status === "complete");
  const locked = allQuests.filter((q) => q.status === "locked");

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 pb-24 pt-6">
      <h1 className="text-2xl">⚔️ 퀘스트</h1>

      {active.length > 0 && (
        <section>
          <h2 className="mb-3 text-base text-status-active">진행중</h2>
          <div className="space-y-3">{active.map((q) => <QuestCard key={q.id} quest={q} />)}</div>
        </section>
      )}

      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-base text-status-pending">승인대기</h2>
          <div className="space-y-3">{pending.map((q) => <QuestCard key={q.id} quest={q} />)}</div>
        </section>
      )}

      {complete.length > 0 && (
        <section>
          <h2 className="mb-3 text-base text-status-complete">완료</h2>
          <div className="space-y-3">{complete.map((q) => <QuestCard key={q.id} quest={q} />)}</div>
        </section>
      )}

      {locked.length > 0 && (
        <section>
          <h2 className="mb-3 text-base text-status-locked">잠김</h2>
          <div className="space-y-3">{locked.map((q) => <QuestCard key={q.id} quest={q} />)}</div>
        </section>
      )}
    </div>
  );
};

export default QuestsPage;

import { useNavigate } from "react-router-dom";
import { TV_BRANCHES } from "@/lib/branchAlias";

/**
 * myboxer153.com/tv — 지점 코드를 빼고 열었을 때 나오는 선택 화면.
 *
 * TV 리모컨으로 긴 주소를 치는 게 번거로워서, 짧은 주소 하나만 외우면 되게 했다.
 * 여기서 지점을 한 번 누르면 보드로 들어가고, 그 뒤로는 아래 안내된 짧은 주소를
 * 그 TV 의 시작페이지로 넣어두면 다시 고를 필요가 없다.
 */
const TvBranchPicker = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-950 px-10 text-white select-none">
      <div className="mb-2 flex items-baseline gap-4">
        <span className="text-4xl">🥊</span>
        <h1 className="text-5xl font-black tracking-tight">마이복서153 라이브보드</h1>
      </div>
      <p className="mb-12 text-2xl font-bold text-gray-400">띄울 지점을 골라주세요</p>

      <div className="grid w-full max-w-6xl grid-cols-2 gap-6 lg:grid-cols-4">
        {TV_BRANCHES.map((b) => (
          <button
            key={b.code}
            onClick={() => navigate(`/tv/${b.code}`)}
            className="flex flex-col items-center gap-3 rounded-2xl border border-gray-700 bg-gray-900 px-6 py-10 transition-all hover:border-green-500 hover:bg-gray-800 active:scale-[0.98]"
          >
            <span className="text-4xl font-black">{b.label}</span>
            <span className="rounded-full bg-gray-800 px-4 py-1.5 text-xl font-black tabular-nums text-green-400">
              /tv/{b.short}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-14 rounded-2xl border border-gray-800 bg-gray-900/60 px-8 py-5 text-center">
        <p className="text-xl font-bold text-gray-300">
          다음부터는 짧은 주소를 바로 치셔도 됩니다
        </p>
        <p className="mt-2 text-2xl font-black text-green-400">
          myboxer153.com/tv/s
        </p>
        <p className="mt-2 text-lg font-bold text-gray-500">
          s 선릉 · j 잠실 · y 역삼 · c 칠금 &nbsp;|&nbsp; 두 대로 나누려면 뒤에 /1 · /2
        </p>
      </div>
    </div>
  );
};

export default TvBranchPicker;

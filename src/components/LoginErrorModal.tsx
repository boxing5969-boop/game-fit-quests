import { AlertTriangle, Clock, ShieldAlert, WifiOff, KeyRound, HelpCircle } from "lucide-react";

export type ErrorType = "approval_pending" | "coach_approval_pending" | "email_verify" | "invalid_credentials" | "network" | "unknown";

interface LoginErrorModalProps {
  type: ErrorType;
  onClose: () => void;
  onRetry?: () => void;
}

const ERROR_CONFIG: Record<ErrorType, { icon: React.ReactNode; title: string; body: string; color: string }> = {
  approval_pending: {
    icon: <Clock className="h-10 w-10" />,
    title: "승인 대기 중입니다",
    body: "소속 지점 관장님의 승인이 완료되면 로그인 및 서비스 이용이 가능합니다.\n\n승인 전까지는 로그인이 제한됩니다.",
    color: "text-amber-500",
  },
  coach_approval_pending: {
    icon: <ShieldAlert className="h-10 w-10" />,
    title: "전체관리자 승인 대기 중입니다",
    body: "관장님 가입 신청이 접수되었습니다.\n\n전체관리자가 승인하면 로그인 및 관장님 기능을 사용할 수 있습니다.",
    color: "text-blue-500",
  },
  email_verify: {
    icon: <AlertTriangle className="h-10 w-10" />,
    title: "이메일 인증이 필요합니다",
    body: "가입 시 입력한 이메일로 인증 링크를 발송했습니다.\n\n이메일을 확인하고 인증 링크를 클릭해주세요.",
    color: "text-orange-500",
  },
  invalid_credentials: {
    icon: <KeyRound className="h-10 w-10" />,
    title: "아이디 또는 비밀번호가 올바르지 않습니다",
    body: "입력한 아이디와 비밀번호를 다시 확인해주세요.\n\n비밀번호를 잊으셨다면 '비밀번호를 잊으셨나요?'를 이용해주세요.",
    color: "text-destructive",
  },
  network: {
    icon: <WifiOff className="h-10 w-10" />,
    title: "네트워크 오류가 발생했습니다",
    body: "인터넷 연결을 확인하고 다시 시도해주세요.\n\n문제가 계속되면 잠시 후 다시 시도해주세요.",
    color: "text-gray-500",
  },
  unknown: {
    icon: <HelpCircle className="h-10 w-10" />,
    title: "계정 상태를 확인할 수 없습니다",
    body: "일시적인 오류가 발생했습니다.\n\n잠시 후 다시 시도해주세요.",
    color: "text-muted-foreground",
  },
};

export function classifyLoginError(message: string): ErrorType {
  if (message.includes("승인 대기") && message.includes("관장님")) return "approval_pending";
  if (message.includes("관장님 가입 승인") || message.includes("관리자 승인")) return "coach_approval_pending";
  if (message.includes("이메일 인증") || message.includes("email") && message.includes("confirm")) return "email_verify";
  if (message.includes("아이디 또는 비밀번호") || message.includes("Invalid login") || message.includes("올바르지 않습니다")) return "invalid_credentials";
  if (message.includes("네트워크") || message.includes("fetch") || message.includes("network")) return "network";
  return "unknown";
}

const LoginErrorModal = ({ type, onClose, onRetry }: LoginErrorModalProps) => {
  const config = ERROR_CONFIG[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 ${config.color}`}>
          {config.icon}
        </div>

        {/* Title */}
        <h2 className="mb-3 text-center text-xl font-bold text-foreground">{config.title}</h2>

        {/* Body */}
        <div className="mb-6 text-center text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
          {config.body}
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98]"
            >
              다시 시도
            </button>
          )}
          <button
            onClick={onClose}
            className={`w-full rounded-xl py-3 text-sm font-medium transition-all active:scale-[0.98] ${
              onRetry
                ? "border border-border text-muted-foreground"
                : "bg-primary text-primary-foreground shadow-md font-bold"
            }`}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginErrorModal;

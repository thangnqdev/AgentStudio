import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  errorMessage: string;
};

/**
 * ErrorBoundary bảo vệ message list trong ChatArea.
 * Nếu một AgentMessage hoặc UserMessage crash khi render (ví dụ: markdown/code malformed),
 * ErrorBoundary bắt lỗi và hiển thị fallback thay vì làm trắng xóa toàn bộ chat.
 */
export class MessageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unknown render error',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log để dễ debug trong dev mode
    console.error('[MessageErrorBoundary] Caught render error:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-start gap-3 py-4 px-3 rounded-2xl border border-error/20 bg-error/5">
          <span
            className="material-symbols-outlined text-[18px] text-error shrink-0 mt-0.5"
            aria-hidden="true"
          >
            error_outline
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-ui-label-bold text-[13px] text-error mb-1">
              Không thể hiển thị tin nhắn
            </p>
            <p className="text-[12px] text-on-surface-variant font-code-base break-all">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={this.handleRetry}
              className="mt-2 text-[11px] text-secondary hover:underline font-ui-label-bold"
            >
              Thử lại
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

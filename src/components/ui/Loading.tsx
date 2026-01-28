interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export function Loading({ message = '読み込み中...', fullScreen = false }: LoadingProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-lg text-text-secondary">{message}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80">
        {content}
      </div>
    );
  }

  return <div className="flex min-h-[200px] items-center justify-center">{content}</div>;
}

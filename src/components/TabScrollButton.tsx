export function TabScrollButton(props: {
  direction: 'back' | 'forward';
  disabled: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const back = props.direction === 'back';
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className={`flex shrink-0 items-center justify-center border-outline-variant/60 bg-toolbar text-on-surface-variant hover:bg-interactive-hover hover:text-on-surface disabled:opacity-25 ${props.compact ? 'h-8 w-6' : 'h-10 w-7'} ${back ? 'border-r' : 'border-l'}`}
      title={back ? 'Cuộn tab sang trái' : 'Cuộn tab sang phải'}
      aria-label={back ? 'Cuộn tab sang trái' : 'Cuộn tab sang phải'}
    >
      <span className={`material-symbols-outlined ${props.compact ? 'text-[14px]' : 'text-[16px]'}`}>
        {back ? 'chevron_left' : 'chevron_right'}
      </span>
    </button>
  );
}

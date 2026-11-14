/** Transient status message shown above the status bar. */

interface Props {
  message: string;
  show: boolean;
}

export function Toast({ message, show }: Props) {
  return (
    <div
      id="toast"
      className={`toast${show ? " show" : ""}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}

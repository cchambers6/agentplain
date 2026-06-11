// Square corners — no rounded-* classes. No shadow-* semantic classes.
export function PauseForm() {
  return (
    <div className="border border-rule bg-paper p-5">
      <input className="mt-1 block w-full border border-rule bg-paper px-3 py-2" />
      <button className="bg-clay text-paper px-4 py-2">
        Save
      </button>
    </div>
  );
}

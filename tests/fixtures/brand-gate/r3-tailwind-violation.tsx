// Tailwind rounded-* and shadow-* classes that violate brand standards.
export function PauseForm() {
  return (
    <div className="rounded-md border border-rule bg-paper p-5">
      <input className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2" />
      <button className="rounded-full bg-clay text-paper px-4 py-2 shadow-md">
        Save
      </button>
    </div>
  );
}

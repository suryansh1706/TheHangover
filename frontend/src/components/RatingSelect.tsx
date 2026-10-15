export function RatingSelect({ name, label }: { name: string; label: string }) {
  return (
    <label>
      {label} <small>Optional</small>
      <select name={name}>
        <option value="">Skip</option>
        {[1, 2, 3, 4, 5].map((rating) => (
          <option key={rating} value={rating}>
            {rating} / 5
          </option>
        ))}
      </select>
    </label>
  );
}

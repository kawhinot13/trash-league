/** Initials from a full name: "Shai Gilgeous-Alexander" -> "SG", "Nikola Jokić" -> "NJ". */
export const initialsOf = (name: string) =>
  name
    .replace(/\b(Jr|Sr|II|III|IV)\.?$/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .filter((c) => /\p{L}/u.test(c))
    .slice(0, 2)
    .join("")
    .toUpperCase();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?(?:\.\d{1,6})?$/;

function validCalendarDate(value) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const roles = ["admin", "equipe", "cliente"];
export const serviceTypes = ["consulta", "banho", "tosa", "exame", "hotel", "procedimento"];

export function input(body = {}) {
  const errors = [];
  const value = {};

  const requiredString = (name, max = 255) => {
    const item = typeof body[name] === "string" ? body[name].trim() : "";
    if (!item || item.length > max) errors.push(`${name} deve ter entre 1 e ${max} caracteres`);
    else value[name] = item;
    return item;
  };

  const optionalString = (name, max = 1000) => {
    if (body[name] == null || body[name] === "") return (value[name] = null);
    const item = typeof body[name] === "string" ? body[name].trim() : "";
    if (!item || item.length > max) errors.push(`${name} deve ter entre 1 e ${max} caracteres`);
    else value[name] = item;
    return item;
  };

  const email = (name = "email") => {
    const item = requiredString(name, 254).toLowerCase();
    if (item && !EMAIL_RE.test(item)) errors.push(`${name} inválido`);
    value[name] = item;
    return item;
  };

  const positiveInt = (name, optional = false) => {
    if (optional && (body[name] == null || body[name] === "")) return (value[name] = null);
    const item = Number(body[name]);
    if (!Number.isSafeInteger(item) || item <= 0) errors.push(`${name} deve ser um inteiro positivo`);
    else value[name] = item;
    return item;
  };

  const nonNegativeInt = (name) => {
    const item = Number(body[name]);
    if (!Number.isSafeInteger(item) || item < 0) errors.push(`${name} deve ser um inteiro não negativo`);
    else value[name] = item;
    return item;
  };

  const positiveNumber = (name, optional = false) => {
    if (optional && (body[name] == null || body[name] === "")) return (value[name] = null);
    const item = Number(body[name]);
    if (!Number.isFinite(item) || item <= 0) errors.push(`${name} deve ser um número positivo`);
    else value[name] = item;
    return item;
  };

  const oneOf = (name, allowed) => {
    if (!allowed.includes(body[name])) errors.push(`${name} inválido`);
    else value[name] = body[name];
    return body[name];
  };

  const date = (name, optional = false, datetime = false) => {
    if (optional && (body[name] == null || body[name] === "")) return (value[name] = null);
    const item = typeof body[name] === "string" ? body[name].trim() : "";
    const validShape = (datetime ? DATETIME_RE : DATE_RE).test(item);
    const parsed = validShape ? Date.parse(datetime ? item.replace(" ", "T") : `${item}T00:00:00Z`) : NaN;
    if (!validShape || !validCalendarDate(item) || Number.isNaN(parsed)) errors.push(`${name} deve ser uma data ISO válida`);
    else value[name] = item;
    return item;
  };

  return { errors, value, requiredString, optionalString, email, positiveInt, nonNegativeInt, positiveNumber, oneOf, date };
}

export function assertValid(result) {
  if (result.errors.length) {
    const error = new Error(result.errors[0]);
    error.status = 400;
    throw error;
  }
  return result.value;
}

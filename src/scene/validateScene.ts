// scene.json の実行時バリデーション。
// サーバー（/api/scene）と監視セッション（npm run validate:scene）の両方がこれを使う。

const ITEM_TYPES = new Set(["card", "note", "list", "table", "group"]);
const NOTE_TONES = new Set(["warning", "info"]);

/** `${type}_` + 3桁以上の数字（例 card_001） */
const ITEM_ID_RE = /^(card|note|list|table|group)_\d{3,}$/;
/** `edge_` + 3桁以上の数字（例 edge_001） */
const EDGE_ID_RE = /^edge_\d{3,}$/;
/**
 * 空文字以外の ISO8601 日時（例 2026-07-09T00:00:00.000Z）。
 * Date.parse の正規化に頼らず、暦日・時分秒・オフセットをキャプチャして検証する。
 */
const ISO8601_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  return 31;
}

/** 空文字、または実在する ISO8601 日時文字列（2月30日等の暦外日は不可） */
function isValidUpdatedAt(value: string): boolean {
  if (value === "") return true;
  const match = ISO8601_RE.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;

  // オフセットがある場合のみ match[7..9] が入る（Z のときは undefined）
  if (match[7] !== undefined) {
    const offsetHour = Number(match[8]);
    const offsetMinute = Number(match[9]);
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }

  return true;
}

function itemIdMatchesType(id: string, type: string): boolean {
  return id.startsWith(`${type}_`) && ITEM_ID_RE.test(id);
}

/** エラーメッセージの配列を返す。空配列なら妥当 */
export function validateScene(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["scene はオブジェクトである必要があります"];
  }
  const errors: string[] = [];

  if (typeof value.version !== "number" || !Number.isInteger(value.version) || value.version < 1) {
    errors.push("version は 1 以上の整数である必要があります");
  }
  if (typeof value.title !== "string") {
    errors.push("title は文字列である必要があります");
  }
  if (typeof value.updatedAt !== "string") {
    errors.push("updatedAt は文字列である必要があります");
  } else if (!isValidUpdatedAt(value.updatedAt)) {
    errors.push("updatedAt は空文字または ISO8601 日時である必要があります");
  }
  if (!Array.isArray(value.items)) {
    errors.push("items は配列である必要があります");
    return errors;
  }
  if (!Array.isArray(value.edges)) {
    errors.push("edges は配列である必要があります");
    return errors;
  }

  const itemIds = new Set<string>();
  const groupIds = new Set<string>();

  value.items.forEach((item: unknown, index: number) => {
    const where = `items[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${where} はオブジェクトである必要があります`);
      return;
    }
    if (typeof item.id !== "string" || item.id === "") {
      errors.push(`${where}.id は空でない文字列である必要があります`);
      return;
    }
    if (itemIds.has(item.id)) {
      errors.push(`${where}.id "${item.id}" が重複しています`);
      return;
    }
    itemIds.add(item.id);
    if (typeof item.type !== "string" || !ITEM_TYPES.has(item.type)) {
      errors.push(`${where} (${item.id}) の type が不正です: ${String(item.type)}`);
      return;
    }
    if (!itemIdMatchesType(item.id, item.type)) {
      errors.push(
        `${where} (${item.id}) の id は "${item.type}_" + 3桁以上の数字である必要があります`,
      );
    }
    if (item.type === "group") {
      groupIds.add(item.id);
      if (item.groupId !== undefined) {
        errors.push(`${where} (${item.id}) group に groupId は付けられません（入れ子非対応）`);
      }
      if (typeof item.title !== "string") {
        errors.push(`${where} (${item.id}) group.title は文字列である必要があります`);
      }
      return;
    }
    if (!isOptionalString(item.groupId)) {
      errors.push(`${where} (${item.id}) groupId は文字列である必要があります`);
    }
    switch (item.type) {
      case "card":
        if (typeof item.title !== "string") {
          errors.push(`${where} (${item.id}) card.title は文字列である必要があります`);
        }
        if (!isOptionalString(item.body)) {
          errors.push(`${where} (${item.id}) card.body は文字列である必要があります`);
        }
        break;
      case "note":
        if (typeof item.text !== "string") {
          errors.push(`${where} (${item.id}) note.text は文字列である必要があります`);
        }
        if (item.tone !== undefined && (typeof item.tone !== "string" || !NOTE_TONES.has(item.tone))) {
          errors.push(`${where} (${item.id}) note.tone は "warning" か "info" である必要があります`);
        }
        break;
      case "list":
        if (!isOptionalString(item.title)) {
          errors.push(`${where} (${item.id}) list.title は文字列である必要があります`);
        }
        if (!isStringArray(item.items)) {
          errors.push(`${where} (${item.id}) list.items は文字列の配列である必要があります`);
        }
        break;
      case "table":
        if (!isOptionalString(item.title)) {
          errors.push(`${where} (${item.id}) table.title は文字列である必要があります`);
        }
        if (!isStringArray(item.columns)) {
          errors.push(`${where} (${item.id}) table.columns は文字列の配列である必要があります`);
        }
        if (!Array.isArray(item.rows) || !item.rows.every((row: unknown) => isStringArray(row))) {
          errors.push(`${where} (${item.id}) table.rows は文字列配列の配列である必要があります`);
        } else if (isStringArray(item.columns)) {
          const colCount = item.columns.length;
          item.rows.forEach((row: unknown, rowIndex: number) => {
            if (!isStringArray(row)) return;
            if (row.length !== colCount) {
              errors.push(
                `${where} (${item.id}) table.rows[${rowIndex}] の列数 (${row.length}) が columns.length (${colCount}) と一致しません`,
              );
            }
          });
        }
        break;
    }
  });

  // groupId の参照整合性（2パス目）
  value.items.forEach((item: unknown, index: number) => {
    if (!isRecord(item) || typeof item.groupId !== "string" || typeof item.id !== "string") return;
    if (!groupIds.has(item.groupId)) {
      errors.push(`items[${index}] (${item.id}) の groupId "${item.groupId}" は存在する group を指していません`);
    }
  });

  const edgeIds = new Set<string>();
  value.edges.forEach((edge: unknown, index: number) => {
    const where = `edges[${index}]`;
    if (!isRecord(edge)) {
      errors.push(`${where} はオブジェクトである必要があります`);
      return;
    }
    if (typeof edge.id !== "string" || edge.id === "") {
      errors.push(`${where}.id は空でない文字列である必要があります`);
      return;
    }
    if (edgeIds.has(edge.id)) {
      errors.push(`${where}.id "${edge.id}" が重複しています`);
    }
    edgeIds.add(edge.id);
    if (!EDGE_ID_RE.test(edge.id)) {
      errors.push(`${where} (${edge.id}) の id は "edge_" + 3桁以上の数字である必要があります`);
    }
    for (const key of ["source", "target"] as const) {
      const ref = edge[key];
      if (typeof ref !== "string" || !itemIds.has(ref)) {
        errors.push(`${where} (${edge.id}) の ${key} "${String(ref)}" は存在する item を指していません`);
      }
    }
    // 空文字 label は許容（現状データに label: "" がある）
    if (!isOptionalString(edge.label)) {
      errors.push(`${where} (${edge.id}) label は文字列である必要があります`);
    }
    // evidence は任意。空文字も許容（未記入と同義）
    if (!isOptionalString(edge.evidence)) {
      errors.push(`${where} (${edge.id}) evidence は文字列である必要があります`);
    }
  });

  return errors;
}

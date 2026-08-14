import { menuById } from "./menu";
import type { GroupBuy, Member, OrderRequest } from "./types";

type ImportResult = {
  members: Member[];
  requests: OrderRequest[];
  unmatchedLines: string[];
};

const itemAliases: Array<[string, string[]]> = [
  ["chocolate-mochi", ["朱古力榛子糯米糍", "巧克力榛子糯米糍"]],
  ["pistachio-mochi", ["開心果糯米糍", "开心果糯米糍"]],
  ["nut-mochi", ["堅果糯米糍", "坚果糯米糍"]],
  ["hakka-mochi-seaweed-pork-floss", ["海苔肉鬆糯米糍", "海苔肉松糯米糍"]],
  ["ham-sui-gok", ["家鄉珍珠鹹水角", "家乡珍珠咸水角", "鹹水角", "咸水角"]],
  ["sa-yung", ["糖沙翁", "沙翁", "蛋球"]],
  ["pandan-layer-cake", ["斑斕椰汁千層糕", "斑斓椰汁千层糕", "斑斕椰汁糕", "斑斓椰汁糕"]],
  ["jujube-ginger-layer-cake", ["紅棗薑汁千層糕", "红枣姜汁千层糕"]],
  ["sesame-layer-cake", ["黑芝麻椰汁千層糕", "黑芝麻椰汁千层糕"]],
  ["duck-wing", ["滷味鴨翅膀", "卤味鸭翅膀", "滷水鴨翼", "卤水鸭翼"]],
  ["pork-ear", ["滷味豬耳朵", "卤味猪耳朵", "滷水豬耳", "卤水猪耳", "豬耳", "猪耳"]],
  ["pork-intestine", ["滷味豬腸", "卤味猪肠", "滷水豬腸", "卤水猪肠"]],
  ["pork-bun", ["北方鮮肉包子", "北方鲜肉包子"]],
  ["taro-cake", ["廣式臘味芋頭糕", "广式腊味芋头糕", "臘味芋頭糕", "腊味芋头糕", "芋頭糕", "芋头糕"]],
  ["thai-tea-cold-cake", ["泰式奶茶涼糕", "泰式奶茶凉糕"]],
  ["sticky-rice", ["廣式臘味糯米飯", "广式腊味糯米饭", "臘味糯米飯", "腊味糯米饭", "糯米飯", "糯米饭"]],
  ["turnip-cake", ["廣式臘味蘿蔔糕", "广式腊味萝卜糕", "蘿蔔糕", "萝卜糕"]],
  ["put-chai-ko", ["廣式缽仔糕", "广式钵仔糕", "砵仔糕", "缽仔糕", "钵仔糕"]],
  ["purple-rice-taro-cake", ["台式紫米芋泥涼糕", "台式紫米芋泥凉糕"]],
  ["double-skin-milk", ["順德雙皮奶", "顺德双皮奶"]],
  ["pepper-pork-soup", ["胡椒豬肚湯", "胡椒猪肚汤"]],
  ["sesame-film-roll", ["黑芝麻菲林卷"]],
  ["ma-lai-go", ["古法馬拉糕", "古法马拉糕"]],
];

function clean(value: string) {
  return value.toLowerCase().replace(/[\s（）()／/、，,。.·$]/g, "");
}

function findItemId(line: string) {
  const normalized = clean(line);
  return itemAliases.find(([, aliases]) =>
    aliases.some((alias) => normalized.includes(clean(alias))),
  )?.[0];
}

function findItemIds(line: string) {
  const normalized = clean(line);
  if (normalized.includes("糯米糍") || normalized.includes("艾糍")) {
    const flavorItems = [
      ["hakka-mochi-peanut-sesame", ["花生芝麻"]],
      ["hakka-mochi-taro", ["芋泥"]],
      ["hakka-mochi-red-bean", ["紅豆", "红豆"]],
      ["hakka-mochi-seaweed-pork-floss", ["海苔肉鬆", "海苔肉松"]],
    ] as const;
    const matches = flavorItems
      .filter(([, flavors]) => flavors.some((flavor) => normalized.includes(clean(flavor))))
      .map(([itemId]) => itemId);
    if (matches.length > 0) return matches;
  }
  const itemId = findItemId(line);
  return itemId ? [itemId] : [];
}

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `member-${Date.now()}`;
}

function fixedAmount(line: string, itemId: string) {
  const item = menuById.get(itemId);
  const withoutPackagePrice = line.replace(/\$?\s*\d+\s*\/\s*\d+\s*(?:個|个|件)/gi, "");
  const pieces = withoutPackagePrice.match(/(?:要|想要|可要)?\s*([0-9]+)\s*(?:個|个|件)/i);
  if (pieces) return Number(pieces[1]);
  if (/半\s*(?:盒|份)/.test(line)) {
    return item?.unitKind === "piece" ? (item.piecesPerPackage ?? 1) / 2 : 0.5;
  }
  const fraction = line.match(/(?:^|[^0-9])([1-9])\s*\/\s*([1-9])(?![0-9])/i);
  return fraction ? Number(fraction[1]) / Number(fraction[2]) : undefined;
}

function flavorFrom(line: string) {
  const flavors = ["海苔肉鬆", "海苔肉松", "花生芝麻", "芋泥", "紅豆", "红豆"];
  const found = flavors.filter((flavor) => line.includes(flavor));
  return found.length > 0 ? found.join("／") : undefined;
}

function noteFrom(line: string) {
  if (/可\s*share|可獨食|可独食/i.test(line)) return "可 Share 或獨食";
  const wingShare = line.match(/wing\s*share\s*(芋泥|花生芝麻|海苔肉[鬆松]|[紅红]豆)?/i);
  return wingShare ? `Wing Share${wingShare[1] ? ` ${wingShare[1]}` : ""}` : undefined;
}

export function parseOrderMessage(text: string, current: GroupBuy): ImportResult {
  const members: Member[] = [];
  const requests: OrderRequest[] = [];
  const unmatchedLines: string[] = [];
  const knownMembers = current.members;
  let activeMember: Member | undefined;
  let defaultShare = false;
  let wholeSection = false;
  let requestIndex = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^[-—_－]+$/.test(line)) continue;

    const knownMember = knownMembers.find((member) =>
      line.toLowerCase().startsWith(member.name.toLowerCase()),
    );
    const newMemberHeading = findItemIds(line).length === 0 && /^[A-Za-z][A-Za-z ]+(?:[（(].*[）)])?$/.test(line);
    if (knownMember || newMemberHeading) {
      const name = knownMember?.name ?? line.replace(/[（(].*$/, "").trim();
      activeMember = members.find((member) => member.name.toLowerCase() === name.toLowerCase()) ?? {
        id: knownMember?.id ?? slug(name),
        name,
        note: knownMember?.note,
      };
      if (!members.some((member) => member.id === activeMember?.id)) members.push(activeMember);
      const headingNote = line.match(/[（(](.*)[）)]/)?.[1];
      if (headingNote) activeMember.note = headingNote;
      defaultShare = false;
      wholeSection = false;
      continue;
    }

    if (!activeMember) {
      unmatchedLines.push(line);
      continue;
    }
    if (/全份/.test(line) && !findItemId(line)) {
      wholeSection = true;
      if (/^[（(].*[）)]$/.test(line)) activeMember.note = line.slice(1, -1);
      continue;
    }
    if (/全部可以\s*share|can\s*share/i.test(line)) {
      defaultShare = true;
      continue;
    }
    if (/^[（(].*[）)]$/.test(line) && !findItemId(line)) {
      activeMember.note = line.slice(1, -1);
      continue;
    }

    const itemIds = findItemIds(line);
    if (itemIds.length === 0) {
      unmatchedLines.push(line);
      continue;
    }
    const activeMemberId = activeMember.id;
    itemIds.forEach((itemId) => {
      const amount = fixedAmount(line, itemId);
      const share = /share|可\s*share|可獨食|可独食/i.test(line) || defaultShare || amount !== undefined;
      const quantityMatch = line.match(/[x×]\s*([0-9]+)/i);
      requests.push({
        id: `import-${Date.now()}-${++requestIndex}`,
        memberId: activeMemberId,
        itemId,
        mode: wholeSection || !share ? "whole" : "share",
        minimum: amount,
        fixed: amount !== undefined,
        quantity: quantityMatch ? Number(quantityMatch[1]) : undefined,
        flavor: itemId.startsWith("hakka-mochi-") ? undefined : flavorFrom(line),
        note: noteFrom(line),
      });
    });
  }

  return { members, requests, unmatchedLines };
}
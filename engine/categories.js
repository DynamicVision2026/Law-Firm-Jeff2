// The 16 problem categories the AI sorts people into, with labels in all three
// languages, which ones have a deep lawyer pack, and per-market cost help.
// Lawyers can edit the labels and cost text freely.

export const CATEGORIES = [
  { id: "money_owed",  money: true,  ja: "貸したお金・未払い金の回収", "zh-Hant": "借款・欠款追討", "zh-Hans": "借款・欠款追讨" },
  { id: "own_debt",    money: true,  ja: "借金・債務の悩み", "zh-Hant": "債務・欠債問題", "zh-Hans": "债务・欠债问题" },
  { id: "labor",       money: true,  ja: "給料・残業代・解雇など労働問題", "zh-Hant": "薪資・加班費・解僱等勞資問題", "zh-Hans": "工资・加班费・辞退等劳动争议" },
  { id: "traffic",     money: true,  ja: "交通事故", "zh-Hant": "車禍・交通事故", "zh-Hans": "交通事故", deepPack: "traffic" },
  { id: "insurance",   money: true,  ja: "保険金の支払い拒否・減額", "zh-Hant": "保險理賠被拒・減額", "zh-Hans": "保险理赔被拒・减额" },
  { id: "divorce",     money: true,  ja: "離婚・別居", "zh-Hant": "離婚・分居", "zh-Hans": "离婚・分居" },
  { id: "inheritance", money: true,  ja: "相続・遺言", "zh-Hant": "繼承・遺囑", "zh-Hans": "继承・遗嘱" },
  { id: "child",       money: true,  ja: "親権・養育費", "zh-Hant": "監護權・扶養費", "zh-Hans": "抚养权・抚养费" },
  { id: "housing",     money: true,  ja: "賃貸・住まい（敷金・退去・立ち退き）", "zh-Hant": "租屋・房屋（押金・退租・遷讓）", "zh-Hans": "租房・房屋（押金・退租・腾退）" },
  { id: "consumer",    money: true,  ja: "消費者トラブル・詐欺被害", "zh-Hant": "消費糾紛・詐騙受害", "zh-Hans": "消费纠纷・诈骗受害" },
  { id: "medical",     money: true,  ja: "医療事故", "zh-Hant": "醫療糾紛", "zh-Hans": "医疗纠纷" },
  { id: "neighbor",    money: false, ja: "近隣トラブル", "zh-Hant": "鄰居糾紛", "zh-Hans": "邻里纠纷" },
  { id: "defamation",  money: false, ja: "誹謗中傷・ネットトラブル", "zh-Hant": "誹謗・網路糾紛", "zh-Hans": "诽谤・网络纠纷" },
  { id: "criminal",    money: false, ja: "刑事事件（被害・加害）", "zh-Hant": "刑事案件（被害・被告）", "zh-Hans": "刑事案件（受害・被告）" },
  { id: "visa",        money: false, ja: "在留資格・ビザ", "zh-Hant": "居留・簽證", "zh-Hans": "居留・签证" },
  { id: "other",       money: false, ja: "その他", "zh-Hant": "其他", "zh-Hans": "其他" },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
export const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES.at(-1);

// Market settings: language and where to get affordable help. DRAFT — local lawyers to confirm.
export const MARKETS = {
  jp: {
    lang: "ja",
    cost: "初回相談無料の法律事務所も多くあります。収入が一定以下の方は法テラスの無料法律相談を利用できます。交通事故などでは、保険の弁護士費用特約で自己負担なしになる場合があります。",
    supervision: "弁護士監修",
    disclaimer: "この診断は一般的な情報の提供を目的としたもので、法的助言ではありません。実際の結果は個別の事情により異なります。",
  },
  tw: {
    lang: "zh-Hant",
    cost: "許多律師事務所提供初次諮詢。經濟上有困難時，可向法律扶助基金會申請免費諮詢或扶助（有資格條件）。",
    supervision: "律師監修",
    disclaimer: "本診斷僅提供一般性資訊，不構成法律意見。實際結果會因個別情況而有所不同。",
  },
  cn: {
    lang: "zh-Hans",
    cost: "可拨打12348公共法律服务热线免费咨询。经济困难的，可向当地法律援助中心申请法律援助（有条件限制）。",
    supervision: "律师审核",
    disclaimer: "本诊断仅提供一般性信息，不构成法律意见。实际结果会因个案情况而不同。",
  },
};

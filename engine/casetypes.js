// What each case type asks, what Jeff checks, what a lawyer adds, and typical lawyer fees.
// DRAFT — written by Claude for the local lawyer teams to review and correct before launch.
//
// questions: 2 tap questions only this case type needs (asked before the 3–4 shared ones)
// factors:   3 yes/no checks Jeff makes on the person's own words ("yes" = good for the person)
// help:      one or two sentences: what a lawyer typically changes versus doing it alone
// fee:       typical lawyer fees per market. "percent" = calculate from the amount (Japan's common
//            着手金/報酬金 percentages); otherwise a typical range in local currency.

const L = (ja, tw, cn) => ({ ja, "zh-Hant": tw, "zh-Hans": cn });
const Q = (id, text, options) => ({ id, text, options }); // text and options: L(...)

export const CASE_TYPES = {
  money_owed: {
    questions: [
      Q("relation", L("相手との関係は？", "對方和您的關係？", "对方和您的关系？"),
        L(["友人・知人", "家族・親族", "取引先・会社", "元交際相手"], ["朋友・熟人", "家人・親戚", "客戶・公司", "前任伴侶"], ["朋友・熟人", "家人・亲戚", "客户・公司", "前任伴侣"])),
      Q("admits", L("相手は借りた（払う）ことを認めていますか？", "對方承認有借錢（欠款）嗎？", "对方承认借钱（欠款）吗？"),
        L(["認めている", "あいまい", "否定している", "連絡が取れない"], ["承認", "含糊其辭", "否認", "聯絡不上"], ["承认", "含糊其辞", "否认", "联系不上"])),
    ],
    factors: [
      { id: "proof", yes: "There is written or message evidence of the loan or debt", no: "There is no clear evidence of the loan or debt",
        label: L("貸した証拠がある", "有借款證據", "有借款证据") },
      { id: "admitted", yes: "The other person admits owing the money", no: "The other person denies owing or cannot be reached",
        label: L("相手が借りたことを認めている", "對方承認欠款", "对方承认欠款") },
      { id: "intime", yes: "The money was lent or became due recently (within a few years)", no: "The money became due many years ago",
        label: L("時効の心配が少ない", "時效風險較低", "时效风险较低") },
    ],
    help: L("弁護士名で内容証明を送るだけで支払われることも多く、払わない場合は支払督促・訴訟から差押えまで進められます。",
      "以律師名義寄發存證信函常能促使對方還款；仍不還時，可進行支付命令、訴訟到強制執行。",
      "律师函往往能促使对方还款；仍不还时，可申请支付令、起诉直至强制执行。"),
    fee: { jp: "percent", tw: [30000, 80000], cn: [3000, 20000] },
  },
  own_debt: {
    questions: [
      Q("total", L("借金の合計は？", "債務總額大約？", "债务总额大约？"),
        L(["100万円未満", "100〜300万円", "300〜1000万円", "1000万円以上"], ["50萬元以下", "50～200萬元", "200～500萬元", "500萬元以上"], ["10万元以下", "10～50万元", "50～200万元", "200万元以上"])),
      Q("lenders", L("借入先の数は？", "借款來源有幾家？", "借款来源有几家？"),
        L(["1社", "2〜4社", "5社以上", "個人からも借りている"], ["1家", "2～4家", "5家以上", "也有向個人借"], ["1家", "2～4家", "5家以上", "也向个人借过"])),
    ],
    factors: [
      { id: "income", yes: "The person still has some regular income", no: "The person has no income at the moment",
        label: L("収入がある（返済計画を立てやすい）", "有固定收入", "有固定收入") },
      { id: "long", yes: "The person has been borrowing and repaying for many years (possible overpaid interest)", no: "The borrowing is recent",
        label: L("長期間の返済（過払い金の可能性）", "長期還款", "长期还款") },
      { id: "nocourt", yes: "No court papers or seizure have started yet", no: "Court papers, seizure or collection action have started",
        label: L("まだ裁判・差押えになっていない", "尚未被起訴或查封", "尚未被起诉或查封") },
    ],
    help: L("弁護士が受任通知を送ると督促が止まり、任意整理・個人再生・自己破産から一番負担の小さい方法を選べます。",
      "律師可協助與債權人協商，或評估更生、清算等程序，選擇負擔最小的方式。",
      "律师可协助与债权人协商分期或减免，并评估可行的法律途径，减轻还款压力。"),
    fee: { jp: [5, 40], tw: [30000, 100000], cn: [3000, 20000] },
  },
  labor: {
    questions: [
      Q("issue", L("主な問題は？", "主要問題是？", "主要问题是？"),
        L(["解雇・退職強要", "残業代・給料の未払い", "パワハラ・セクハラ", "その他"], ["解僱・逼退", "加班費・薪資未付", "職場霸凌・性騷擾", "其他"], ["辞退・逼迫离职", "加班费・工资拖欠", "职场霸凌・性骚扰", "其他"])),
      Q("working", L("今もその会社で働いていますか？", "目前還在該公司工作嗎？", "目前还在该公司工作吗？"),
        L(["働いている", "辞めた・解雇された", "休職中"], ["還在職", "已離職・被解僱", "留職停薪中"], ["还在职", "已离职・被辞退", "停职中"])),
    ],
    factors: [
      { id: "records", yes: "There are records such as contracts, payslips, time records or messages", no: "There are no records at all",
        label: L("雇用契約・給与明細・勤怠などの記録", "有勞動契約・薪資單・出勤紀錄", "有劳动合同・工资条・考勤记录") },
      { id: "unfair", yes: "The employer acted suddenly or without a clear reason or procedure", no: "The employer followed a clear reason and procedure",
        label: L("会社の対応に理由・手続きの問題", "公司處理缺乏理由或程序", "公司处理缺乏理由或程序") },
      { id: "nosign", yes: "The person has not signed any resignation or settlement paper", no: "The person already signed a resignation or settlement paper",
        label: L("退職届・合意書にまだサインしていない", "尚未簽署離職或和解文件", "尚未签署离职或和解文件") },
    ],
    help: L("解雇の撤回や解決金、未払い残業代（最大3年分）を会社と交渉でき、労働審判なら多くが数ヶ月で解決します。",
      "律師可協助爭取資遣費、未付工資與加班費，並代為參與勞資調解或訴訟。",
      "律师可协助申请劳动仲裁（免费），争取经济补偿、赔偿金及拖欠工资。"),
    fee: { jp: "percent", tw: [40000, 100000], cn: [5000, 30000] },
  },
  insurance: {
    questions: [
      Q("kind", L("保険の種類は？", "保險種類？", "保险种类？"),
        L(["医療・がん保険", "生命保険", "火災・地震保険", "その他"], ["醫療・癌症險", "壽險", "火險・地震險", "其他"], ["医疗・重疾险", "寿险", "财产险", "其他"])),
      Q("insurer_said", L("保険会社の回答は？", "保險公司的回覆？", "保险公司的答复？"),
        L(["支払い拒否", "減額された", "回答が遅い・ない", "契約解除と言われた"], ["拒絕理賠", "減額理賠", "遲遲不回覆", "被告知解約"], ["拒绝理赔", "减额理赔", "迟迟不答复", "被告知解除合同"])),
    ],
    factors: [
      { id: "policy", yes: "The person has the policy documents and claim papers", no: "The person does not have the policy documents",
        label: L("保険証券・請求書類がある", "有保單與理賠文件", "有保单与理赔材料") },
      { id: "disclosed", yes: "The person told the insurer the truth about health or facts when joining", no: "The person may not have disclosed something when joining",
        label: L("加入時の告知に問題がない", "投保時如實告知", "投保时如实告知") },
      { id: "reason", yes: "The insurer's reason for refusing is unclear or weak", no: "The insurer gave a clear reason based on the policy",
        label: L("保険会社の理由があいまい", "保險公司理由不明確", "保险公司理由不明确") },
    ],
    help: L("約款と医療記録を照らし合わせて反論し、保険会社との交渉やADR（そんぽADR等）で支払いを求められます。",
      "律師可比對條款與病歷提出主張，並透過金融消費評議中心或訴訟爭取理賠。",
      "律师可对照条款与病历提出主张，通过投诉、调解或诉讼争取理赔。"),
    fee: { jp: "percent", tw: [30000, 100000], cn: [5000, 30000] },
  },
  divorce: {
    questions: [
      Q("stage", L("今の状況は？", "目前狀況？", "目前状况？"),
        L(["話し合い中", "別居している", "相手が応じない", "調停・裁判中"], ["協商中", "已分居", "對方不同意", "調解・訴訟中"], ["协商中", "已分居", "对方不同意", "调解・诉讼中"])),
      Q("main", L("一番の争点は？", "最大爭點？", "最大争议点？"),
        L(["お金（財産分与・慰謝料）", "子ども（親権・養育費）", "離婚するかどうか", "まだわからない"], ["金錢（財產・贍養）", "孩子（監護・扶養費）", "是否離婚", "還不清楚"], ["财产分割・赔偿", "孩子（抚养权・抚养费）", "是否离婚", "还不清楚"])),
    ],
    factors: [
      { id: "fault", yes: "There is evidence of the spouse's affair, violence or serious fault", no: "There is no clear fault by the spouse",
        label: L("相手の不貞・暴力などの証拠", "對方外遇・家暴等證據", "对方出轨・家暴等证据") },
      { id: "assets", yes: "The couple has shared property or savings to divide", no: "There is little shared property",
        label: L("分ける財産がある", "有可分配的財產", "有可分割的财产") },
      { id: "separated", yes: "The couple has already been living apart for some time", no: "The couple still lives together",
        label: L("別居が続いている", "已分居一段時間", "已分居一段时间") },
    ],
    help: L("財産分与・慰謝料・養育費を相場に沿って請求でき、相手と直接話さずに交渉・調停を進められます。",
      "律師可依實務行情爭取財產分配、贍養與扶養費，並代您協商，不必與對方直接面對。",
      "律师可依实务标准争取财产分割、损害赔偿与抚养费，并代您协商，避免直接冲突。"),
    fee: { jp: [40, 80], tw: [50000, 150000], cn: [10000, 50000] },
  },
  inheritance: {
    questions: [
      Q("will", L("遺言書はありますか？", "有遺囑嗎？", "有遗嘱吗？"),
        L(["ある", "ない", "あるが内容に納得できない", "わからない"], ["有", "沒有", "有但內容不合理", "不清楚"], ["有", "没有", "有但内容不合理", "不清楚"])),
      Q("dispute", L("何で揉めていますか？", "爭議在哪裡？", "争议在哪里？"),
        L(["分け方", "財産を隠されている", "使い込み", "借金の相続"], ["分配方式", "財產被隱匿", "遺產被挪用", "繼承債務"], ["分配方式", "财产被隐匿", "遗产被挪用", "继承债务"])),
    ],
    factors: [
      { id: "heir", yes: "The person is a close legal heir (child, spouse or parent)", no: "The person is a distant relative",
        label: L("法定相続人（子・配偶者・親）", "法定繼承人（子女・配偶・父母）", "法定继承人（子女・配偶・父母）") },
      { id: "unfair", yes: "One relative took or is keeping most of the estate", no: "The estate is being shared openly",
        label: L("一部の相続人が独占している", "有人獨占遺產", "有人独占遗产") },
      { id: "recent", yes: "The death was recent (within about a year)", no: "The death was many years ago",
        label: L("期限（遺留分1年など）に間に合う", "仍在期限內", "仍在时效内") },
    ],
    help: L("遺産の調査、遺留分の請求（知ってから1年以内）、相続人間の交渉や調停を任せられます。",
      "律師可調查遺產、主張特留分，並代為協商或進行訴訟。",
      "律师可调查遗产、主张继承份额，并代为协商或起诉。"),
    fee: { jp: "percent", tw: [50000, 150000], cn: [10000, 50000] },
  },
  child: {
    questions: [
      Q("issue", L("主な問題は？", "主要問題？", "主要问题？"),
        L(["親権", "養育費が払われない", "面会交流", "連れ去り"], ["監護權", "扶養費未付", "探視", "孩子被帶走"], ["抚养权", "抚养费不付", "探视", "孩子被带走"])),
      Q("agreement", L("取り決めはありますか？", "有書面約定嗎？", "有书面约定吗？"),
        L(["公正証書・調停調書", "口約束のみ", "何もない"], ["有法院或公證文件", "只有口頭約定", "沒有"], ["有法院或公证文书", "只有口头约定", "没有"])),
    ],
    factors: [
      { id: "caregiver", yes: "The person has been the child's main caregiver", no: "The other parent has been the main caregiver",
        label: L("主に子どもの世話をしてきた", "主要照顧者", "主要照顾者") },
      { id: "written", yes: "There is a written agreement or court decision", no: "There is no written agreement",
        label: L("書面の取り決めがある", "有書面約定", "有书面约定") },
      { id: "safe", yes: "There is no violence or danger to the child", no: "There is violence or danger involved",
        label: L("子どもの安全に問題がない", "孩子安全無虞", "孩子安全无虞") },
    ],
    help: L("書面の取り決めがあれば給料の差押えで養育費を回収でき、親権・面会も調停で子ども中心に整理できます。",
      "有書面約定可聲請強制執行扶養費；監護與探視也可透過調解妥善安排。",
      "有判决或调解书可申请强制执行抚养费；抚养权与探视也可通过调解或诉讼解决。"),
    fee: { jp: [30, 60], tw: [50000, 120000], cn: [8000, 30000] },
  },
  housing: {
    questions: [
      Q("role", L("あなたの立場は？", "您的身分？", "您的身份？"),
        L(["借りている（借りていた）", "貸している（大家）"], ["承租人", "房東"], ["租客", "房东"])),
      Q("issue", L("主な問題は？", "主要問題？", "主要问题？"),
        L(["敷金が返らない・退去費用", "立ち退きを求められている", "修理・設備の不具合", "家賃の滞納"], ["押金不退・退租費用", "被要求搬遷", "修繕問題", "欠租"], ["押金不退・退租费用", "被要求搬离", "维修问题", "欠租"])),
    ],
    factors: [
      { id: "photos", yes: "There are photos or records of the room's condition", no: "There are no photos or records of the condition",
        label: L("部屋の状態の写真・記録がある", "有房屋狀況照片", "有房屋状况照片") },
      { id: "wear", yes: "The damage or charge is about normal wear and tear over time", no: "The person clearly caused serious damage",
        label: L("通常の使用による汚れ・劣化", "屬於正常使用耗損", "属于正常使用损耗") },
      { id: "contract", yes: "The rental contract is available to check", no: "There is no rental contract",
        label: L("賃貸契約書がある", "有租賃契約", "有租赁合同") },
    ],
    help: L("国交省ガイドラインに沿って不当な原状回復費を減額・敷金返還を求められ、立ち退きでは立退料を交渉できます。",
      "律師可依租賃規定爭取返還押金、刪減不合理費用；遇到搬遷時可協商補償。",
      "律师可依合同与法律争取退还押金、减免不合理费用；遇到腾退时可协商补偿。"),
    fee: { jp: "percent", tw: [20000, 60000], cn: [3000, 15000] },
  },
  consumer: {
    questions: [
      Q("kind", L("どんなトラブル？", "哪類糾紛？", "哪类纠纷？"),
        L(["ネット通販・定期購入", "投資・副業の勧誘", "高額な契約・解約できない", "詐欺の被害"], ["網購・訂閱", "投資・副業招攬", "高額合約・無法解約", "詐騙受害"], ["网购・订阅", "投资・副业诱导", "高额合同・无法解约", "诈骗受害"])),
      Q("paid", L("お金を払いましたか？", "已經付款了嗎？", "已经付款了吗？"),
        L(["振込で払った", "カード・後払いで払った", "まだ払っていない"], ["轉帳付款", "刷卡・分期", "尚未付款"], ["转账付款", "刷卡・分期", "尚未付款"])),
    ],
    factors: [
      { id: "recent", yes: "The contract or payment was recent (within about a week or a month)", no: "The contract or payment was long ago",
        label: L("契約から日が浅い（クーリングオフ等）", "契約日不久（可能適用解約期）", "签约不久") },
      { id: "records", yes: "There are records such as the contract, ads, messages or payment proof", no: "There are no records",
        label: L("契約書・広告・やりとりの記録", "有契約・廣告・對話紀錄", "有合同・广告・聊天记录") },
      { id: "known", yes: "The seller or company can be identified", no: "The seller is anonymous or cannot be found",
        label: L("相手の会社が特定できる", "可確認對方身分", "可确认对方身份") },
    ],
    help: L("クーリングオフや消費者契約法での取消しを主張でき、詐欺では口座凍結や返金交渉を早く進められます。",
      "律師可主張解約、撤銷契約與退款；詐騙案件可協助報案與追償。",
      "律师可主张解除合同与退款；诈骗案件可协助报案、冻结与追偿。"),
    fee: { jp: "percent", tw: [30000, 80000], cn: [3000, 20000] },
  },
  medical: {
    questions: [
      Q("result", L("どんな結果になりましたか？", "造成什麼結果？", "造成什么结果？"),
        L(["症状が悪化した", "後遺症が残った", "亡くなった", "まだわからない"], ["症狀惡化", "留下後遺症", "死亡", "還不清楚"], ["病情恶化", "留下后遗症", "死亡", "还不清楚"])),
      Q("records", L("カルテなど医療記録は？", "病歷資料？", "病历资料？"),
        L(["取り寄せた", "まだ", "拒否された"], ["已取得", "尚未取得", "被拒絕提供"], ["已取得", "尚未取得", "被拒绝提供"])),
    ],
    factors: [
      { id: "harm", yes: "There is serious, lasting harm", no: "The harm is minor or temporary",
        label: L("重い・残る被害がある", "傷害嚴重或持續", "损害严重或持续") },
      { id: "link", yes: "The harm clearly followed a specific treatment or mistake", no: "It is unclear what caused the harm",
        label: L("特定の処置との関係がはっきり", "與特定醫療行為相關", "与特定医疗行为相关") },
      { id: "records", yes: "The medical records are available", no: "The medical records are not available",
        label: L("医療記録がある", "有病歷", "有病历") },
    ],
    help: L("協力医の意見でミスの有無を調査し、病院との交渉・訴訟で賠償を求められます（調査から始めるのが一般的）。",
      "律師可協同醫師意見調查是否有疏失，並進行醫療調解或訴訟求償。",
      "律师可申请医疗损害鉴定，并通过调解或诉讼主张赔偿。"),
    fee: { jp: [30, 80], tw: [80000, 200000], cn: [10000, 50000] },
  },
  neighbor: {
    questions: [
      Q("issue", L("主な問題は？", "主要問題？", "主要问题？"),
        L(["騒音・におい", "境界・建物", "嫌がらせ", "その他"], ["噪音・氣味", "地界・建物", "騷擾", "其他"], ["噪音・气味", "地界・建筑", "骚扰", "其他"])),
      Q("talked", L("相手と話し合いましたか？", "與對方談過嗎？", "与对方谈过吗？"),
        L(["話したが改善しない", "話せる状態ではない", "管理会社・自治会に相談した"], ["談過但沒改善", "無法溝通", "已向管委會反映"], ["谈过但没改善", "无法沟通", "已向物业・居委会反映"])),
    ],
    factors: [
      { id: "records", yes: "There are recordings, photos or a diary of the problem", no: "There are no records of the problem",
        label: L("録音・写真・日記の記録", "有錄音・照片・紀錄", "有录音・照片・记录") },
      { id: "ongoing", yes: "The problem is ongoing and serious", no: "The problem is occasional or minor",
        label: L("被害が続いていて深刻", "持續且嚴重", "持续且严重") },
      { id: "tried", yes: "The person already tried talking or asking a manager", no: "The person has not tried anything yet",
        label: L("話し合い・管理会社への相談済み", "已嘗試溝通", "已尝试沟通") },
    ],
    help: L("弁護士からの通知や調停で、感情的な対立を避けながら差止めや損害賠償を求められます。",
      "律師可發函或申請調解，避免正面衝突並要求停止侵害。",
      "律师可发函或申请调解，避免正面冲突并要求停止侵害、赔偿损失。"),
    fee: { jp: [20, 40], tw: [30000, 80000], cn: [3000, 15000] },
  },
  defamation: {
    questions: [
      Q("where", L("どこに書かれましたか？", "內容在哪裡？", "内容发在哪里？"),
        L(["SNS（X・Instagram等）", "掲示板・口コミサイト", "動画サイト", "グループチャット"], ["社群（FB・IG・Threads）", "論壇・評論網站", "影音平台", "群組聊天"], ["微博・抖音・小红书等", "论坛・点评网站", "视频平台", "微信群・朋友圈"])),
      Q("poster", L("書いた人はわかりますか？", "知道是誰發的嗎？", "知道是谁发的吗？"),
        L(["わかる", "見当はつく", "まったくわからない"], ["知道", "大概知道", "完全不知道"], ["知道", "大概知道", "完全不知道"])),
    ],
    factors: [
      { id: "saved", yes: "The person saved screenshots with the URL and date", no: "Nothing has been saved yet",
        label: L("URL・日時つきで保存済み", "已截圖並保存網址", "已截图并保存链接") },
      { id: "false", yes: "The post states false facts that can be shown wrong", no: "The post is only an opinion or partly true",
        label: L("事実と違う内容", "內容與事實不符", "内容与事实不符") },
      { id: "damage", yes: "The post caused real damage such as job or customer loss", no: "There is no real damage yet",
        label: L("仕事などに実害が出ている", "已造成實際損害", "已造成实际损失") },
    ],
    help: L("削除請求に加え、発信者情報開示で投稿者を特定し、慰謝料を請求できます（ログが消える前、数ヶ月以内が重要）。",
      "律師可要求平台刪除、協助查明發文者，並提起妨害名譽告訴或民事求償。",
      "律师可要求平台删除、申请法院调取发帖人信息，并起诉要求赔礼道歉与赔偿。"),
    fee: { jp: [30, 80], tw: [40000, 120000], cn: [5000, 30000] },
  },
  criminal: {
    questions: [
      Q("side", L("あなたの立場は？", "您的身分？", "您的身份？"),
        L(["被害者", "加害者・疑われている", "家族が逮捕された"], ["被害人", "被告・被懷疑", "家人被拘捕"], ["受害人", "被怀疑・犯罪嫌疑人", "家人被拘留"])),
      Q("police", L("警察は関わっていますか？", "警方介入了嗎？", "警方介入了吗？"),
        L(["まだ", "被害届・相談済み", "取り調べ・逮捕あり"], ["尚未", "已報案", "已偵訊・拘提"], ["尚未", "已报案", "已讯问・拘留"])),
    ],
    factors: [
      { id: "evidence", yes: "There is evidence such as records, witnesses or video", no: "There is no evidence",
        label: L("証拠・目撃者がある", "有證據或證人", "有证据或证人") },
      { id: "early", yes: "Things are at an early stage before charges or trial", no: "Charges or trial have already started",
        label: L("早い段階（起訴前）", "仍在偵查初期", "仍在侦查初期") },
      { id: "settle", yes: "Settlement or compensation between the sides is possible", no: "Settlement is not possible",
        label: L("示談の可能性がある", "有和解可能", "有和解可能") },
    ],
    help: L("逮捕直後の対応や示談交渉で不起訴の可能性が大きく変わります。被害者側も示談金や告訴を任せられます。",
      "偵查初期的應對與和解，對結果影響很大；被害人也可委任律師提告與求償。",
      "侦查初期的应对与和解，对结果影响很大；受害人也可委托律师报案、追偿。"),
    fee: { jp: [40, 100], tw: [60000, 200000], cn: [10000, 60000] },
  },
  visa: {
    questions: [
      Q("issue", L("どんな手続き？", "哪種手續？", "哪种手续？"),
        L(["更新・変更", "不許可になった", "永住・帰化", "退去強制・収容"], ["延期・變更", "申請被駁回", "永居・歸化", "驅逐出境"], ["续签・变更", "申请被拒", "永居・入籍", "驱逐出境"])),
      Q("deadline", L("期限は？", "期限？", "期限？"),
        L(["1ヶ月以内", "1〜3ヶ月", "まだ余裕がある", "すでに過ぎた"], ["1個月內", "1～3個月", "還有時間", "已過期"], ["1个月内", "1～3个月", "还有时间", "已过期"])),
    ],
    factors: [
      { id: "valid", yes: "The person's current status is still valid", no: "The person's status has expired",
        label: L("在留期限内", "居留仍有效", "居留仍有效") },
      { id: "clean", yes: "The person has no violations such as overstay or crimes", no: "There are violations such as overstay or crimes",
        label: L("違反・前歴がない", "無違規紀錄", "无违规记录") },
      { id: "docs", yes: "The person can prepare the needed documents", no: "Important documents are missing",
        label: L("必要書類をそろえられる", "文件齊全", "材料齐全") },
    ],
    help: L("不許可理由を確認して再申請の書類を整え、退去強制の場面では在留特別許可を求める手続きを任せられます。",
      "律師可分析駁回原因、協助重新申請或提起訴願。",
      "律师可分析被拒原因，协助重新申请或依法复议。"),
    fee: { jp: [10, 40], tw: [20000, 80000], cn: [5000, 30000] },
  },
  other: {
    questions: [],
    factors: [
      { id: "records", yes: "There are documents or messages about the problem", no: "There are no records",
        label: L("記録・証拠がある", "有紀錄或證據", "有记录或证据") },
      { id: "clear", yes: "The other side can be identified", no: "The other side is unknown",
        label: L("相手がはっきりしている", "對方身分明確", "对方身份明确") },
      { id: "nosign", yes: "Nothing important has been signed or decided yet", no: "Something important was already signed or decided",
        label: L("まだ何もサインしていない", "尚未簽署文件", "尚未签署文件") },
    ],
    help: L("状況を整理し、交渉・調停・訴訟のどれが合うか、費用に見合うかを最初の相談で判断できます。",
      "律師可在初次諮詢中判斷適合的處理方式與是否划算。",
      "律师可在初次咨询中判断合适的处理方式及是否划算。"),
    fee: { jp: [20, 40], tw: [30000, 80000], cn: [3000, 20000] },
  },
};

// Traffic uses its own lawyer pack for questions and amounts; these are its Jeff factors and fees.
CASE_TYPES.traffic = {
  questions: [],
  factors: [
    { id: "fault", yes: "The other driver is mainly or fully at fault", no: "The person is mainly at fault or fault is unclear",
      label: L("相手の過失が大きい", "對方過失較大", "对方责任较大") },
    { id: "treated", yes: "The person saw a doctor and has medical records", no: "The person has not seen a doctor",
      label: L("通院・治療の記録がある", "有就醫紀錄", "有就医记录") },
    { id: "nosign", yes: "The person has not signed a settlement with the insurer", no: "The person already signed a settlement",
      label: L("示談書にまだサインしていない", "尚未簽和解書", "尚未签和解协议") },
  ],
  help: L("保険会社は自社の低い基準で提示することが多く、弁護士が入ると裁判基準（赤い本）で交渉するため、慰謝料が大きく上がることがよくあります。弁護士費用特約があれば自己負担0円のことも。",
    "保險公司提出的金額常偏低；律師可依法院實務標準爭取醫療費、薪資損失與精神慰撫金。",
    "保险公司提出的金额常偏低；律师可依法院标准主张医疗费、误工费、护理费及精神损害抚慰金。"),
  fee: { jp: "percent", tw: [40000, 120000], cn: [5000, 30000] },
};

export const caseType = (id) => CASE_TYPES[id] || CASE_TYPES.other;

// ---------- lawyer fees ----------

// Amount bands from the shared "how much money" question, per market (index → [low, high] in local units).
const BANDS = {
  jp: [[3, 10], [10, 60], [60, 140], [140, 300]],          // 万円
  tw: [[3, 10], [10, 50], [50, 150], [150, 300]],          // 萬元 (NT$10,000)
  cn: [[0.3, 1], [1, 5], [5, 20], [20, 50]],               // 万元
};
const SMALL = { jp: 60, tw: 10, cn: 5 }; // small-claims ceilings: 少額訴訟 60万円 / 小額訴訟 10萬元 / 小额诉讼 ≈5万元 (varies by province)

// Japan's commonly used fee scale (based on the former 日弁連 standard): 着手金 / 成功報酬 as a share of the amount.
function jpPercent(x) { // x in 万円 → [着手金, 報酬]
  const start = x <= 300 ? x * 0.08 : x * 0.05 + 9;
  const reward = x <= 300 ? x * 0.16 : x * 0.10 + 18;
  return [Math.max(10, start), reward];
}
const r1 = (n) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);
const rng = (a, b) => (r1(a) === r1(b) ? `${r1(a)}` : `${r1(a)}〜${r1(b)}`);
const yen = (n) => n.toLocaleString("en-US");

export function estimateFee(market, categoryId, amountIndex, bandOverride = null) {
  const fee = caseType(categoryId).fee[market];
  const band = bandOverride || BANDS[market]?.[amountIndex];
  const small = band && band[1] <= SMALL[market];
  if (market === "jp") {
    if (fee === "percent" && band) {
      const [s1, w1] = jpPercent(band[0]), [s2, w2] = jpPercent(band[1]);
      return {
        text: `着手金 約${rng(s1, s2)}万円 ＋ 成功報酬 約${rng(w1, w2)}万円（取り戻せた金額の約${band[1] <= 300 ? 16 : 10}%前後）`,
        small, smallText: small ? "金額が小さく、弁護士費用が回収額を上回る「費用倒れ」になりやすいケースです。60万円以下なら少額訴訟（自分で手続き可能）、法テラス、弁護士費用特約の確認がおすすめです。" : "",
      };
    }
    const [a, b] = Array.isArray(fee) ? fee : [20, 40];
    return { text: `着手金・報酬あわせて 約${a}〜${b}万円が目安（事務所により異なります）`, small: false, smallText: "" };
  }
  if (market === "tw") {
    const [a, b] = Array.isArray(fee) ? fee : [30000, 100000];
    return {
      text: `每一審級律師費約新台幣 ${yen(a)}～${yen(b)} 元；諮詢費約每小時 2,000～5,000 元（依事務所而異）`,
      small, smallText: small ? "金額較小時，律師費可能超過可追回的金額。10萬元以下可考慮小額訴訟或鄉鎮市調解委員會（免費），也可申請法律扶助。" : "",
    };
  }
  const [a, b] = Array.isArray(fee) ? fee : [3000, 20000];
  return {
    text: `一般按件收费约 ${yen(a)}～${yen(b)} 元；涉及金额较大时，也可协商按比例收费或风险代理（各地标准不同）`,
    small, smallText: small ? "金额较小时，律师费可能高于可追回的金额。可考虑小额诉讼、人民调解（免费）或拨打12348咨询。" : "",
  };
}

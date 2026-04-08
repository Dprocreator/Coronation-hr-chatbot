/* ================================================================
   SCRIPT.JS — Coronation X Limited HR Chatbot
   Fully local — no external API calls.
   Smart "what if" engine powered by policy consequence mapping.
   ================================================================ */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

var chatApp = $('.chat-app'), welcomeOverlay = $('#welcomeOverlay');
var startBtn = $('#startBtn');
var chatMessages = $('#chatMessages'), chatInput = $('#chatInput'), sendBtn = $('#sendBtn');
var themeToggle = $('#themeToggle');
var soundToggle = $('#soundToggle');
var categoryBar = $('.category-bar');

let isBotTyping = false, soundEnabled = false;

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function playTick() {
    if (!soundEnabled) return;
    try {
        if (!audioCtx) audioCtx = new AudioCtx();
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(880, audioCtx.currentTime);
        g.gain.setValueAtTime(0.03, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
        o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.08);
    } catch (e) { }
}

function playPop() {
    if (!soundEnabled) return;
    try {
        if (!audioCtx) audioCtx = new AudioCtx();
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(660, audioCtx.currentTime);
        o.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.12);
        g.gain.setValueAtTime(0.04, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.12);
    } catch (e) { }
}


/* ================================================================
   WHAT-IF CONSEQUENCE ENGINE
   Maps scenario topics + actions to policy-based consequences.
   No API calls — entirely local reasoning.
   ================================================================ */

const CONSEQUENCES = {
    probation: {
        fail: "Per our policy, if your performance is **unsatisfactory during the 6-month probation**, your probation may be **extended for a maximum of 3 additional months**. If your performance remains unsatisfactory after that extension, your appointment may be **terminated**. You may also be placed on a **Performance Improvement Plan (PIP)** with monthly monitoring.",
        extend: "Your probation can be **extended by up to 3 months** if your performance is deemed borderline. During the extension, you will have defined deliverables and monthly reviews. After the extension, you will either be **confirmed or terminated**.",
        resign: "During probation, either party may terminate with **7 days written notice**. If you resign during probation, you would pay **2 weeks basic salary in lieu** if not serving notice.",
        default: "Your 6-month probation includes reviews at **Day 30 and Day 60**. If performance is unsatisfactory, it may be extended up to 3 months. Early confirmation is possible in exceptional cases of proficiency. Confirmation requires: successful probation, satisfactory references, onboarding docs complete, orientation attended, and background checks passed."
    },
    leave: {
        not_use: "You must take at least **80% of your leave** before the end of the financial year. Outstanding leave **must be used by March 31** of the following year or it will be **forfeited**. Unspent leave days **cannot be used to offset resignation notice**. Payment in lieu of leave is only made upon termination of service.",
        unauthorized: "Any absence without prior approval or notification is classified as **unauthorized** and treated as **unpaid leave**. Repeated unauthorized absences will trigger the **disciplinary process**. Absence without cause for up to **1 month (abscondment)** results in **Dismissal**.",
        excess: "Leave taken beyond your entitlement will be treated as **unpaid leave**, unless your Supervisor and Head of HR expressly indicate otherwise in exceptional circumstances.",
        cancel: "Coronation X reserves the right to **cancel your leave** under exceptional circumstances. If cancelled, you will be **refunded in full** for any expenses incurred (deposits, tickets, etc.) with proof of disbursement.",
        default: "Annual leave is **20 working days** for Analyst cadre and **30 working days** for Executive cadre. Only confirmed employees are eligible. You must give **2-week notice** to your supervisor. Leave allowance is paid when you proceed on leave (minimum 10 days utilized)."
    },
    maternity: {
        not_confirmed: "If you are **not yet confirmed** (still on probation), your maternity leave will be **without pay**. Only confirmed employees qualify for the 4 months paid maternity leave.",
        early: "If you do not take maternity leave at least **4 weeks before** the birth, you must provide a **Doctor's certificate** confirming fitness to work. Coronation X will **not be held responsible** for any casualties or mishaps.",
        spacing: "**18 months must elapse** between one maternity leave and the next. If this condition is not met, only **50% of salary** will be paid for the overlapping period.",
        miscarriage: "If you have a miscarriage during the **third trimester** or if the child is stillborn, you are entitled to **8 weeks leave** after the event, regardless of whether you had already commenced maternity leave.",
        default: "Maternity leave is **4 months on full pay** for confirmed employees. You must take at least 4 weeks before birth and 12 weeks after. Nursing mothers can close **1 hour early for 3 months** after post-natal leave. Adoption entitles you to **14 weeks**. Surrogacy follows the same policy."
    },
    paternity: {
        not_confirmed: "Paternity leave is only applicable to **confirmed staff**. If you are still on probation, you would not be eligible for the 10 days paid paternity leave.",
        late: "Paternity leave **must be taken within 3 months** of the birth. After 3 months, the entitlement lapses. It is a welfare package and **cannot be commuted to cash**.",
        default: "You are entitled to **10 days paid paternity leave** at the time of your child's birth. It must be taken within 3 months and applies only to confirmed staff."
    },
    notice: {
        skip: "If you resign without serving the required notice period, you must **pay the organisation an amount equivalent to one month's basic salary in lieu** (two months for Management staff). For unconfirmed employees, it is **two weeks basic salary**.",
        default: "Confirmed employees must give **one month's notice** (two months for Management). Unconfirmed employees give **two weeks**. Outstanding leave days **cannot be used as terminal leave** but will be monetized as exit benefits."
    },
    dress_code: {
        violate: "Dress code violations follow the disciplinary process: **1st offence = Verbal Warning**, **2nd offence = 1st Warning Letter**, **3rd offence = 2nd Warning Letter**. You may be asked to leave work to change clothes. Supervisors are accountable for team compliance.",
        default: "Coronation X operates two dress forms: **Business Casual** (non-client-facing) and **Business Professional** (client-facing). The Coronation Way means professional dress reflecting the brand. Jeans, flip-flops, tracksuits, and ripped clothing are never acceptable."
    },
    misconduct: {
        minor: "Minor misconduct (dress code, lateness, poor attitude) follows progressive discipline **outside the Disciplinary Committee**: Verbal Warning → 1st Warning → 2nd Warning. Three sanctions above 1st warning in 12 months triggers a **DC hearing**.",
        major: "Major misconduct (unauthorized absence, insubordination, abuse of office) goes to the **Disciplinary Committee**: sanctions range from **Final Warning** to **Suspension** to **Termination**. Unauthorized use of company name = **immediate Termination**.",
        gross: "Gross misconduct (fraud, theft, harassment, weapons, falsification) can lead to **immediate Termination or Summary Dismissal** after a DC hearing. Summary Dismissal means **no benefits** except your own pension contributions. If fraud/forgery is involved, you may be **reported to financial regulators**.",
        falsely_accused: "You have the right to: receive **48-hour notice** before a DC hearing, **state your case**, call witnesses, present mitigating factors, object to panel members, and **appeal within 5 working days** to the MD/CEO-chaired Appeal Committee. You may be suspended with pay during investigation — this is **not a presumption of guilt**.",
        default: "The disciplinary policy is corrective, not punitive. Misconduct is classified into 3 tiers: **Minor** (outside DC), **Major** (DC hearing), and **Gross** (DC + possible Summary Dismissal). Appeals are available within 5 working days."
    },
    marriage: {
        colleague: "Per Coronation X policy, the organisation **shall not retain married couples** in its employment. If two employees marry each other, **one must be disengaged** — either through voluntary resignation or termination by the organisation. This is a strict policy with no exceptions.",
        family: "Coronation X **cannot employ family members** of current staff (permanent or contract) or engaged consultants. If a family relationship is discovered, both employees must notify HR formally and complete the **Family Declaration Form**. They will be excluded from the same function, evaluating each other, and considering each other for promotion.",
        default: "Coronation X has a strict policy: married couples cannot both work at the organisation. If two employees marry, one must leave. Family members of current staff cannot be employed."
    },
    absence: {
        month: "Absence without leave or reasonable cause for up to **1 month** is classified as **abscondment** and results in **Dismissal**. HR must be notified immediately by your Line Manager of any unauthorized absence.",
        unauthorized: "All unauthorized absences are treated as **unpaid leave**. Your Line Manager must notify HR immediately. Repeated unauthorized absences escalate through the **disciplinary process**. During notice period, unauthorized absence is treated as unpaid leave and may attract **additional disciplinary action**.",
        default: "Authorized absence requires proper notification to your line manager. Unauthorized absence = unpaid leave. Abscondment (1 month unauthorized) = Dismissal."
    },
    performance: {
        low: "If you receive a **C rating (55-65.99% — Needs Improvement)**, you will be placed on a **3-month Performance Improvement Plan (PIP)** with monthly monitoring. A **first D rating (Below 55%)** or **2 consecutive C ratings** means you will be **counselled out** of the organisation.",
        promotion: "For promotion below Manager level: **A* rating ×1** + 12 months on grade = Promote. **A rating ×2** + 24 months = Promote. **B rating ×3** + 36 months = Promote at management discretion. **Fast Track/Double Promotion** requires 2 consecutive A* ratings + specialized skills + Board approval.",
        bonus: "Performance bonus payout depends on rating: **A* (86%+) = above 100%** of eligible amount, **A (76-85%) = 100%**, **B (66-75%) = 80%**, **C (55-65%) = 70%**, **D (below 55%) = no bonus**. You must be employed on the disbursement date. Under disciplinary action = ineligible.",
        default: "Performance is managed via Balanced Scorecard with quarterly check-ins and bi-annual appraisals. Ratings range from A* (Exceptional, 86%+) to D (Unacceptable, below 55%). The Collegiate Committee ensures fair and consistent assessment."
    },
    remote: {
        personal_device: "You may use personal devices for remote work, but they **must first be validated** by the Information Technology Department and configured to company security standards.",
        public_wifi: "Employees **shall not use any public Wi-Fi** for work purposes. All connections must be secure. A separate allocated room is recommended for remote working.",
        default: "Coronation X operates a hybrid model. Company provides laptops, internet, and phones. Hard disk encryption is required. No public Wi-Fi. You cannot be terminated for working remotely except for gross misconduct."
    },
    retirement: {
        default: "Retirement is effective at age **60** or upon completion of **35 years of continuous service**, whichever comes first. The organisation gives **3 months notice** or 3 months basic salary in lieu. Early retirement is possible for ill health or continuous productivity decline."
    },
    handover: {
        inadequate: "If you do not provide an adequate handover, your **final entitlements may be delayed or withheld** until the outstanding clearance is completed. You must submit a detailed handover note **at least 1 week** before your exit date.",
        default: "You must prepare a detailed handover note covering: work done, work outstanding, items being handed over, and all relevant information. Submit to your Supervisor at least 1 week before your final exit date."
    },
    confidentiality: {
        breach: "Breaching confidentiality obligations may result in **disciplinary action up to and including termination**, as well as potential **legal proceedings**. This applies both during and after employment. Divulging confidential information without authority is classified as **Gross Misconduct** — the first offence can result in **Suspension**, the second in **Termination**.",
        default: "All employees sign confidentiality terms on hire. Confidential information includes trade secrets, business plans, pricing, customer data, strategies, and financials. Disclosure is prohibited during and after employment."
    },
    gift: {
        receive: "Employees **shall not accept any gift or favour** from vendors, citizens, corporations, or firms that is intended to influence decisions or discharge of duties. Failure to comply with the Gift Policy is a **Major Misconduct**: 1st offence = Final Warning, 2nd = Suspension, 3rd = Termination.",
        default: "No gifts or favours intended to influence your decisions are permitted. Any gift of significant value must be reported. Violations are treated as Major Misconduct."
    },
    whistleblowing: {
        retaliation: "Coronation X provides **full protection** against adverse employment actions (discharge, demotion, suspension, harassment, discrimination) for employees who report allegations in good faith. Retaliation against a whistleblower is itself a serious offence.",
        default: "The whistleblowing policy encourages reporting of malpractice/misconduct. Protection is guaranteed against retaliation. Applies to all employees, contractors, suppliers, and stakeholders. Failure to whistleblow when aware of misconduct is classified as **Major Misconduct**."
    },
    suspension: {
        fraud: "For fraud-related suspension: **no remuneration** during suspension. You must **report weekly** to the Investigation Unit. Failure to report for **2 weeks** = deemed abandoned = **summary dismissal**. Maximum suspension is **3 months**. If fully exonerated, salary is **refunded with interest** (Monetary Policy Rate + 200 basis points).",
        default: "Suspension is used when continued presence could impede investigation. Maximum 3 months. IT disables access and ID is withheld. For fraud cases, no pay during suspension. Full exoneration = salary refunded with interest."
    },
    appeal: {
        default: "You can appeal any disciplinary sanction within **5 working days** of receiving the decision. Submit in writing to the Head of HR. The Appeal Committee (MD/CEO + 2 senior managers with no prior involvement) hears the appeal within 5 days. Outcome communicated within 1 week. The original sanction remains in effect during appeal unless overturned."
    },
    training: {
        miss_mandatory: "Failure to complete mandatory training follows an escalation: **Day 25 = automated reminder**, **Day 30 = manager notified**. Continued non-compliance leads to sanctions per the disciplinary policy. Regulatory mandatory training must be completed within **2 months** of your start date.",
        cancel: "Cancellation of scheduled training requires **line manager + HR approval**. The **cancellation fee will be charged** to you unless a substitute is arranged at least 1 week prior. Exceptions for personal emergencies at HR discretion.",
        default: "L&D uses multiple methods: on-the-job, e-learning, coaching, mentoring, job shadowing, webinars, instructor-led. The Employee Bursary Scheme provides up to ₦350,000 at 0% interest. 10 days exam leave per year. Study leave up to 2 years unpaid for 3+ years service."
    },
    loan: {
        default: "Coronation X provides three types of staff loans: **Personal Loan** (emergency needs), **Car Loan** (vehicle purchase), and **Mortgage** (home purchase). Each has specific eligibility criteria. These are non-statutory benefits provided based on grade."
    },
    sick: {
        prolonged: "Sick leave tiers: **12 working days** (minor), **up to 1 month/22 days** (full pay), **up to 2 months/44 days** (full pay), **up to 3 months/66 days** (full pay). Beyond 3 months, **management discretion** applies. You must notify your Supervisor and HR when you cannot come to the office due to illness.",
        default: "Short-term sickness: 12 days. Extended illness covered up to 3 months with full pay. Beyond 3 months, management discretion applies."
    }
};

/**
 * LOCAL WHAT-IF ENGINE
 * Parses the question for topic + action keywords,
 * then looks up the relevant consequence from CONSEQUENCES map.
 */
function getWhatIfResponse(input) {
    const lower = input.toLowerCase();

    // Topic detection — which policy area?
    const topicMap = [
        { keys: ['probation', 'probationary', 'confirm', '6 months', '180 days', 'new joiner'], topic: 'probation' },
        { keys: ['maternity', 'pregnant', 'pregnancy', 'nursing', 'adoption', 'surrogacy', 'miscarriage', 'stillborn'], topic: 'maternity' },
        { keys: ['paternity', 'father', 'dad'], topic: 'paternity' },
        { keys: ['leave', 'vacation', 'annual leave', 'time off', 'leave days'], topic: 'leave' },
        { keys: ['notice', 'resign', 'resignation', 'quit', 'exit', 'leaving'], topic: 'notice' },
        { keys: ['dress', 'dress code', 'attire', 'clothing','shoe','casual', 'coronation way'], topic: 'dress_code' },
        { keys: ['misconduct', 'disciplinary', 'warning', 'fired', 'sacked', 'terminated', 'theft', 'fraud', 'stealing', 'sanction'], topic: 'misconduct' },
        { keys: ['marry', 'married', 'spouse', 'couple', 'wedding', 'husband', 'wife', 'family member', 'relative'], topic: 'marriage' },
        { keys: ['absent', 'absence', 'awol', 'abscond', 'no show', 'unauthorized absence'], topic: 'absence' },
        { keys: ['performance', 'rating', 'appraisal', 'review', 'pip', 'kpi', 'bonus'], topic: 'performance' },
        { keys: ['remote', 'work from home', 'wfh', 'hybrid', 'wifi', 'personal device'], topic: 'remote' },
        { keys: ['retire', 'retirement', '60 years', '35 years'], topic: 'retirement' },
        { keys: ['handover', 'hand over', 'exit clearance'], topic: 'handover' },
        { keys: ['confidential', 'secret', 'nda', 'disclose', 'leak'], topic: 'confidentiality' },
        { keys: ['gift', 'favour', 'vendor gift', 'bribe'], topic: 'gift' },
        { keys: ['whistle', 'whistleblow', 'report misconduct', 'malpractice', 'retaliation'], topic: 'whistleblowing' },
        { keys: ['suspend', 'suspension'], topic: 'suspension' },
        { keys: ['appeal', 'challenge', 'dispute'], topic: 'appeal' },
        { keys: ['training', 'mandatory training', 'course', 'learning'], topic: 'training' },
        { keys: ['loan', 'personal loan', 'car loan', 'mortgage', 'staff loan'], topic: 'loan' },
        { keys: ['sick', 'illness', 'ill', 'unwell', 'medical leave', 'sickness'], topic: 'sick' },
    ];

    // Action detection — what scenario?
    const actionMap = [
        { keys: ['fail', 'not pass', 'unsatisfactory', 'poor', 'low rating', 'bad'], action: 'fail' },
        { keys: ['skip', 'not serve', 'without notice', 'leave without', 'don\'t serve', 'refuse to serve'], action: 'skip' },
        { keys: ['violate', 'break', 'breach', 'not follow', 'ignore', 'disobey'], action: 'violate' },
        { keys: ['not use', 'don\'t use', 'unused', 'forfeit', 'not take', 'don\'t take'], action: 'not_use' },
        { keys: ['unauthorized', 'without approval', 'without permission', 'unapproved', 'no approval'], action: 'unauthorized' },
        { keys: ['excess', 'more than', 'beyond', 'exceed', 'over'], action: 'excess' },
        { keys: ['cancel', 'cancelled'], action: 'cancel' },
        { keys: ['extend', 'extension', 'prolonged', 'longer'], action: 'extend' },
        { keys: ['not confirmed', 'unconfirmed', 'still on probation', 'before confirmation'], action: 'not_confirmed' },
        { keys: ['early', 'before', 'ahead', 'prior'], action: 'early' },
        { keys: ['spacing', '18 months', 'too soon', 'another maternity', 'second pregnancy'], action: 'spacing' },
        { keys: ['miscarriage', 'stillborn', 'pregnancy loss'], action: 'miscarriage' },
        { keys: ['late', 'after', 'past', 'expired', 'missed deadline'], action: 'late' },
        { keys: ['colleague', 'coworker', 'co-worker', 'another employee', 'each other', 'two employees'], action: 'colleague' },
        { keys: ['family', 'relative', 'related', 'sibling', 'cousin'], action: 'family' },
        { keys: ['month', '1 month', 'one month', '30 days'], action: 'month' },
        { keys: ['minor'], action: 'minor' },
        { keys: ['major'], action: 'major' },
        { keys: ['gross', 'serious', 'severe'], action: 'gross' },
        { keys: ['falsely accused', 'false accusation', 'wrongly accused', 'innocent', 'not guilty'], action: 'falsely_accused' },
        { keys: ['retaliation', 'retaliate', 'punished for reporting'], action: 'retaliation' },
        { keys: ['fraud', 'steal', 'embezzle', 'misappropriate'], action: 'fraud' },
        { keys: ['public wifi', 'public wi-fi', 'coffee shop'], action: 'public_wifi' },
        { keys: ['personal device', 'own laptop', 'my phone', 'own phone'], action: 'personal_device' },
        { keys: ['miss', 'not complete', 'don\'t complete', 'overdue', 'deadline'], action: 'miss_mandatory' },
        { keys: ['low', 'c rating', 'd rating', 'needs improvement', 'unacceptable', 'underperform'], action: 'low' },
        { keys: ['promotion', 'promoted', 'promote', 'advance', 'move up'], action: 'promotion' },
        { keys: ['bonus', 'incentive', 'variable pay'], action: 'bonus' },
        { keys: ['receive', 'accept', 'take', 'given'], action: 'receive' },
        { keys: ['inadequate', 'poor handover', 'don\'t hand over', 'no handover'], action: 'inadequate' },
        { keys: ['breach', 'share', 'disclose', 'tell someone', 'leak'], action: 'breach' },
        { keys: ['sick for long', 'more than 3 months', 'long term', 'long illness', 'prolonged'], action: 'prolonged' },
    ];

    // Find best topic match
    let bestTopic = null, bestTopicScore = 0;
    for (const t of topicMap) {
        let score = 0;
        for (const k of t.keys) if (lower.includes(k)) score += k.length;
        if (score > bestTopicScore) { bestTopicScore = score; bestTopic = t.topic; }
    }

    if (!bestTopic || !CONSEQUENCES[bestTopic]) return null;

    // Find best action match
    let bestAction = null, bestActionScore = 0;
    for (const a of actionMap) {
        let score = 0;
        for (const k of a.keys) if (lower.includes(k)) score += k.length;
        if (score > bestActionScore) { bestActionScore = score; bestAction = a.action; }
    }

    const topicData = CONSEQUENCES[bestTopic];

    // Try specific action first, then fall back to default
    if (bestAction && topicData[bestAction]) return topicData[bestAction];
    if (topicData.default) return topicData.default;
    return null;
}


// ================================================================
//  KNOWLEDGE BASE — Coronation X Limited
// ================================================================

const knowledgeBase = [
    {
        id: 'handbook',
        keywords: ['handbook', 'employee handbook', 'employment', 'employment type', 'full time', 'part time', 'contract', 'temporary', 'working hours', 'attendance', 'hours', 'resumption', 'overtime'],
        response: "Here are the general employment policies from the Coronation X Employee Handbook.",
        card: {
            icon: '\u{1F4D6}', iconClass: 'amber', title: 'Employee Handbook',
            items: [
                '<strong>Full-Time</strong> \u2014 40+ hours/week after 6-month probation, full benefits',
                '<strong>Contract</strong> \u2014 Via staffing agencies, fixed-term, 40 hours/week, some benefits',
                '<strong>Temporary</strong> \u2014 Set length/project, not eligible for benefits',
                '<strong>Working Hours</strong> \u2014 8:00 AM to 5:00 PM, Monday\u2013Friday (40 hours)',
                '<strong>Lunch Break</strong> \u2014 1 hour between 12 noon and 4 PM',
                '<strong>ID Card</strong> \u2014 Issued on engagement, must be carried at all times on premises'
            ],
            action: 'Read Full Handbook \u2192'
        }
    },
    {
        id: 'probation',
        keywords: ['probation', 'probationary', 'confirmation', 'new joiner', 'first 6 months', '180 days', 'confirmed', 'confirm', 'trial period'],
        response: "Here are the probation and confirmation details at Coronation X.",
        card: {
            icon: '\u{1F4CB}', iconClass: 'teal', title: 'Probation Period',
            items: [
                '<strong>Duration</strong> \u2014 180 days (6 months) for professional employees',
                '<strong>Extension</strong> \u2014 Up to 3 additional months if performance is unsatisfactory',
                '<strong>Early Confirmation</strong> \u2014 Possible in exceptional cases of proficiency',
                '<strong>Confirmation Requires</strong> \u2014 Successful probation, satisfactory references, onboarding docs, orientation, background checks',
                '<strong>Failure</strong> \u2014 Appointment may be terminated after extension',
                '<strong>PIP</strong> \u2014 May be placed on Performance Improvement Plan during probation'
            ],
            action: 'Check Probation Status \u2192'
        }
    },
    {
        id: 'transfer',
        keywords: ['transfer', 'redeployment', 'move teams', 'change department', 'internal mobility', 'job rotation', 'redeploy'],
        response: "Here is the transfer and redeployment policy.",
        card: {
            icon: '\u{1F504}', iconClass: 'teal', title: 'Transfer & Redeployment',
            items: [
                '<strong>Type</strong> \u2014 Transfers are permanent (not time-bound like rotation)',
                '<strong>Eligibility</strong> \u2014 Minimum 24 months in Organisation + 6 months in current function',
                '<strong>Process</strong> \u2014 Express interest in vacancy \u2192 Interview \u2192 2-week notice \u2192 Redeployment letter',
                '<strong>Note</strong> \u2014 HR endeavors to replace departing employee but will not delay transfer'
            ],
            action: 'View Internal Vacancies \u2192'
        }
    },
    {
        id: 'married_couples',
        keywords: ['married', 'spouse', 'couple', 'family member', 'relative', 'husband', 'wife', 'marry', 'wedding', 'relationship'],
        response: "Coronation X has a strict policy on married couples and family members.",
        card: {
            icon: '\u{1F46B}', iconClass: 'red', title: 'Married Couples & Family Policy',
            items: [
                '<strong>Rule</strong> \u2014 Coronation X shall NOT retain married couples in employment',
                '<strong>Marriage</strong> \u2014 If two employees marry, one must be disengaged',
                '<strong>Family Members</strong> \u2014 Cannot employ family of current staff or consultants',
                '<strong>Discovery</strong> \u2014 Must notify HR + complete Family Declaration Form',
                '<strong>Restrictions</strong> \u2014 No same function, no evaluating each other, no considering for promotion/salary'
            ],
            action: 'Read Full Policy \u2192'
        }
    },
    {
        id: 'conduct',
        keywords: ['code of conduct', 'conduct', 'ethics', 'integrity', 'conflict of interest', 'gift', 'gifts', 'outside employment'],
        response: "The Code of Conduct reflects Coronation X\u2019s commitment to the highest ethical standards.",
        card: {
            icon: '\u{1F6E1}\uFE0F', iconClass: 'green', title: 'Code of Conduct & Ethics',
            items: [
                '<strong>Standard</strong> \u2014 Business conducted per applicable laws and highest ethics',
                '<strong>Conflict of Interest</strong> \u2014 No activity creating conflict between duties and personal interests',
                '<strong>Company Time</strong> \u2014 No private purposes during work time',
                '<strong>Outside Work</strong> \u2014 No employment that interferes with duties',
                '<strong>Gifts</strong> \u2014 No gifts/favours from vendors/clients intended to influence decisions',
                '<strong>Financial Interest</strong> \u2014 No interest that impacts duty performance'
            ],
            action: 'Read Code of Conduct \u2192'
        }
    },
    {
        id: 'confidentiality',
        keywords: ['confidential', 'confidentiality', 'privacy', 'nda', 'secret', 'official secret', 'disclosure', 'data protection', 'trade secret'],
        response: "Confidentiality obligations at Coronation X are comprehensive.",
        card: {
            icon: '\u{1F512}', iconClass: 'amber', title: 'Privacy & Confidentiality',
            items: [
                '<strong>Scope</strong> \u2014 Trade secrets, business plans, pricing, customer/supplier info, strategies, financials',
                '<strong>During & After</strong> \u2014 Cannot use confidential info for personal benefit, during or after employment',
                '<strong>Official Secrets</strong> \u2014 No disclosure except in ordinary course of business or with MD/CEO permission',
                '<strong>Violation</strong> \u2014 May result in disciplinary action and legal proceedings'
            ],
            action: 'Read Privacy Policy \u2192'
        }
    },
    {
        id: 'harassment',
        keywords: ['harassment', 'sexual harassment', 'bully', 'bullying', 'intimidation', 'victimization', 'racial', 'abuse', 'hostile'],
        response: "Coronation X has zero tolerance for all forms of harassment.",
        card: {
            icon: '\u{1F6AB}', iconClass: 'red', title: 'Harassment Policy',
            items: [
                '<strong>Racial</strong> \u2014 Jokes/gestures about colour, race, religion, nationality, dress/culture',
                '<strong>Bullying</strong> \u2014 Persistent negative acts, shouting, sarcasm, derogatory remarks',
                '<strong>Victimization</strong> \u2014 Unlawful retaliation against complainants',
                '<strong>Sexual</strong> \u2014 Unwelcome advances, requests for favours, quid pro quo, sexual favouritism',
                '<strong>Reporting</strong> \u2014 Report to Head-HR to preserve anonymity. Head-HR initiates enquiry',
                '<strong>Protection</strong> \u2014 Confidential handling, protection from retaliation and false accusations'
            ],
            action: 'Report an Incident \u2192'
        }
    },
    {
        id: 'salary',
        keywords: ['salary', 'pay', 'payroll', 'payslip', 'wage', 'compensation', 'deduction', 'tax', 'paye', 'pension', 'nhf', 'fixed pay', 'basic pay', '13th month', 'housing allowance', 'transport allowance'],
        response: "Here is the Total Rewards compensation structure at Coronation X.",
        card: {
            icon: '\u{1F4B0}', iconClass: 'amber', title: 'Total Rewards & Salary',
            items: [
                '<strong>Philosophy</strong> \u2014 75th\u2013100th percentile of benchmarked market',
                '<strong>Fixed Pay</strong> \u2014 Basic + Housing + Transport + Other Allowances + 13th Month',
                '<strong>Pay Date</strong> \u2014 On or by the 22nd of each month',
                '<strong>Pay Structure</strong> \u2014 Pay Band system with min-to-max range per grade',
                '<strong>Pension</strong> \u2014 Company 10% + Employee 8% of Basic+Housing+Transport',
                '<strong>NHF</strong> \u2014 2.5% of basic salary (NHF Act 1992)',
                '<strong>PAYE</strong> \u2014 Per Personal Income Tax Act 2011'
            ],
            action: 'View Payslip \u2192'
        }
    },
    {
        id: 'grades',
        keywords: ['grade', 'grades', 'band', 'level', 'seniority', 'officer', 'manager', 'director', 'executive trainee', 'assistant officer', 'senior officer', 'agm', 'gm', 'dgm'],
        response: "Coronation X uses a 5-band grade structure.",
        card: {
            icon: '\u{1F4CA}', iconClass: 'teal', title: 'Grade Structure',
            items: [
                '<strong>Band 5 (Director)</strong> \u2014 MD/CEO, Executive Director \u2014 Strategic direction & policy',
                '<strong>Band 4 (Exec Mgmt)</strong> \u2014 GM, DGM, AGM \u2014 Policy decisions & operational objectives',
                '<strong>Band 3 (Middle Mgmt)</strong> \u2014 Senior Manager to Asst. Manager \u2014 Interpret objectives & mentor',
                '<strong>Band 2 (Supervisors)</strong> \u2014 Senior Officer, Officer \u2014 Daily operational actions',
                '<strong>Band 1 (Entry Level)</strong> \u2014 Asst. Officer, Executive Trainee \u2014 Defined tasks'
            ],
            action: 'View Grade Details \u2192'
        }
    },
    {
        id: 'incentives',
        keywords: ['bonus', 'incentive', 'variable pay', 'performance bonus', 'lti', 'long term', 'short term', 'expense optimisation'],
        response: "Coronation X offers multiple incentive programmes.",
        card: {
            icon: '\u{1F3AF}', iconClass: 'green', title: 'Incentives & Bonuses',
            items: [
                '<strong>Variable Pay</strong> \u2014 Based on employee\u2019s overall performance',
                '<strong>Performance Bonus</strong> \u2014 Organisation-level, discretionary, based on company performance',
                '<strong>Expense Optimisation</strong> \u2014 Factor of Performance Bonus for teams beating budget targets',
                '<strong>Long Term Incentive</strong> \u2014 Rewards for long-term goals, aligns employee-shareholder interests'
            ],
            action: 'Learn More \u2192'
        }
    },
    {
        id: 'benefits_in_kind',
        keywords: ['status car', 'car benefit', 'mobile phone', 'airtime', 'internet data', 'professional subscription', 'staff loan', 'personal loan', 'car loan', 'mortgage', 'loan'],
        response: "Non-statutory benefits provided by Coronation X.",
        card: {
            icon: '\u{1F697}', iconClass: 'amber', title: 'Benefits-in-Kind',
            items: [
                '<strong>Status Car</strong> \u2014 Cash-based benefit for specific grades with set limits',
                '<strong>Mobile Phone</strong> \u2014 Based on grade and role with assigned limits',
                '<strong>Airtime & Data</strong> \u2014 Allowance based on grade and role',
                '<strong>Prof. Subscription</strong> \u2014 Support for professional development per grade',
                '<strong>Personal Loan</strong> \u2014 For emergency needs',
                '<strong>Car Loan</strong> \u2014 For purchasing personal vehicles',
                '<strong>Mortgage</strong> \u2014 For purchasing homes. Eligibility criteria apply'
            ],
            action: 'Check Eligibility \u2192'
        }
    },
    {
        id: 'sick_leave',
        keywords: ['sick', 'sick leave', 'illness', 'ill', 'unwell', 'medical leave', 'sickness', 'prolonged illness'],
        response: "Coronation X provides tiered sick leave with full pay.",
        card: {
            icon: '\u{1F912}', iconClass: 'red', title: 'Sick Leave Policy',
            items: [
                '<strong>Short-term</strong> \u2014 12 working days for minor ill health',
                '<strong>Short/Medium</strong> \u2014 Up to 1 month (22 working days) with full pay',
                '<strong>Medium-term</strong> \u2014 Up to 2 months (44 working days) with full pay',
                '<strong>Long-term</strong> \u2014 Up to 3 months (66 working days) with full pay',
                '<strong>Beyond 3 months</strong> \u2014 Management discretion applies',
                '<strong>Notification</strong> \u2014 Must notify Supervisor and HR'
            ],
            action: 'Submit Sick Leave \u2192'
        }
    },
    {
        id: 'recognition',
        keywords: ['recognition', 'award', 'erap', 'long service', 'key talent', 'top deal', 'innovation award', 'brand ambassador', 'one coronation', 'champion'],
        response: "Coronation X runs a comprehensive Employee Recognition Awards Programme (ERAP).",
        card: {
            icon: '\u{1F3C6}', iconClass: 'amber', title: 'Recognition Awards (ERAP)',
            items: [
                '<strong>Long Service</strong> \u2014 Every 5 years: MD/CEO letter + 1 month net salary',
                '<strong>Key Talent</strong> \u2014 Top performers with high leadership potential',
                '<strong>Top Deal</strong> \u2014 Monthly/Quarterly/Yearly for impactful deals',
                '<strong>Innovation</strong> \u2014 For revenue, efficiency, or cost-saving improvements',
                '<strong>Brand Ambassador</strong> \u2014 All employees vote. Winner on intranet for 1 month',
                '<strong>One Coronation</strong> \u2014 For ecosystem value-creation initiatives',
                '<strong>Rewards</strong> \u2014 Training, cash gifts, dinners, mentorship with leaders'
            ],
            action: 'Nominate a Colleague \u2192'
        }
    },
    {
        id: 'welfare',
        keywords: ['welfare', 'marriage support', 'childbirth', 'bereavement support', 'wedding', 'baby', 'death support', 'support payment', 'eap', 'employee assistance', 'counselling', 'creche', 'gym', 'fitness', 'social club'],
        response: "Coronation X provides welfare support and employee assistance.",
        card: {
            icon: '\u{1F381}', iconClass: 'green', title: 'Welfare & Assistance',
            items: [
                '<strong>Marriage</strong> \u2014 \u20A665,000 one-time support + congratulatory message',
                '<strong>Childbirth</strong> \u2014 \u20A625,000 one-time support',
                '<strong>Bereavement</strong> \u2014 \u20A610,000 (parents, spouse, children, siblings only)',
                '<strong>EAP</strong> \u2014 Free wellness: stress management, counselling, mental health',
                '<strong>Childcare</strong> \u2014 Creche facility available',
                '<strong>Fitness</strong> \u2014 Physical fitness facility provided',
                '<strong>Social Club</strong> \u2014 Subscription for eligible employees by grade'
            ],
            action: 'Notify HR \u2192'
        }
    },
    {
        id: 'medical',
        keywords: ['medical', 'hmo', 'health', 'hospital', 'insurance', 'medical scheme', 'health care', 'doctor', 'nhis', 'group life', 'accident insurance', 'nsitf'],
        response: "Coronation X provides comprehensive insurance and medical coverage.",
        card: {
            icon: '\u{1F3E5}', iconClass: 'green', title: 'Insurance & Medical',
            items: [
                '<strong>Health (HMO)</strong> \u2014 Via NHIS-accredited HMO. Employee + Spouse + 4 dependants',
                '<strong>Group Life</strong> \u2014 Minimum 3\u00d7 annual total emolument (Pension Reform Act)',
                '<strong>NSITF</strong> \u2014 1% payroll. Covers workplace injuries & occupational diseases',
                '<strong>Group Accident</strong> \u2014 24/7 protection against disability/death from accidents',
                '<strong>Disability</strong> \u2014 Temporary and permanent disability coverage included'
            ],
            action: 'View My Coverage \u2192'
        }
    },
    {
        id: 'performance',
        keywords: ['performance', 'review', 'appraisal', 'evaluation', 'goals', 'kpi', 'rating', 'half year', 'end of year', 'pip', 'improvement plan', 'balanced scorecard', 'collegiate', 'promotion criteria'],
        response: "Coronation X uses the Balanced Scorecard approach for performance management.",
        card: {
            icon: '\u{1F4CA}', iconClass: 'amber', title: 'Performance Management',
            items: [
                '<strong>Method</strong> \u2014 Balanced Scorecard: Financial, Process, Customer, People, Culture, Projects',
                '<strong>Cycle</strong> \u2014 Quarterly check-ins (Apr/Oct) + Mid-Year (Jul) + Full-Year (Jan)',
                '<strong>Ratings</strong> \u2014 A* (86%+), A (76-85%), B (66-75%), C (55-65%), D (<55%)',
                '<strong>KPIs</strong> \u2014 SMART goals, signed off by 2nd week of February',
                '<strong>Collegiate</strong> \u2014 MD/CEO chairs review committee for consistency',
                '<strong>PIP</strong> \u2014 C rating = 3-month PIP. D or 2 consecutive Cs = Counselled out'
            ],
            action: 'View My Goals \u2192'
        }
    },
    {
        id: 'training',
        keywords: ['training', 'course', 'learn', 'development', 'l&d', 'learning', 'skill', 'upskill', 'bursary', 'ebs', 'educational', 'coaching', 'mentoring', 'e-learning', 'webinar', 'job shadow', 'competency'],
        response: "Coronation X has a comprehensive L&D framework with multiple learning interventions.",
        card: {
            icon: '\u{1F4DA}', iconClass: 'green', title: 'Learning & Development',
            items: [
                '<strong>Philosophy</strong> \u2014 Learning culture with rewards for developing new skills',
                '<strong>Conventional</strong> \u2014 On-the-Job, Self-Paced, Instructor-Led, Seminars/Conferences',
                '<strong>Contemporary</strong> \u2014 e-Learning, Virtual Instructor, Webinars, Job Shadowing, Coaching, Mentoring',
                '<strong>Mandatory</strong> \u2014 Regulatory training within 2 months of start date',
                '<strong>Bursary (EBS)</strong> \u2014 \u20A6350,000 at 0% interest for confirmed employees',
                '<strong>Exam Leave</strong> \u2014 10 days/year separate from annual leave',
                '<strong>Competency</strong> \u2014 Framework tests, evaluates, and develops all levels'
            ],
            action: 'Browse Learning \u2192'
        }
    },
    {
        id: 'certification',
        keywords: ['certification', 'certificate', 'exam', 'examination', 'professional', 'reimbursement', 'study leave'],
        response: "Coronation X supports professional certification and study.",
        card: {
            icon: '\u{1F393}', iconClass: 'teal', title: 'Certifications & Study',
            items: [
                '<strong>Pre-Exam</strong> \u2014 Advance covering registration and exam fees',
                '<strong>During Exam</strong> \u2014 10 working days exam leave (separate from annual leave)',
                '<strong>Post-Exam</strong> \u2014 Fee reimbursement upon passing',
                '<strong>Post-Grad</strong> \u2014 Must be in field relevant to core business and current role',
                '<strong>Bursary Cap</strong> \u2014 \u20A6350,000 at 0% interest',
                '<strong>Study Leave</strong> \u2014 Up to 2 years unpaid for 3+ years service employees'
            ],
            action: 'Apply for Support \u2192'
        }
    },
    {
        id: 'dresscode',
        keywords: ['dress', 'dress code', 'attire', 'clothing','shoe', 'appearance', 'professional dress', 'casual', 'coronation way', 'business casual', 'business formal', 'grooming', 'suit', 'jeans', 'kaftan', 'ankara'],
        response: "Coronation X has two dress code forms: Business Casual and Business Professional.",
        card: {
            icon: '\u{1F454}', iconClass: 'teal', title: 'Dress Code Policy',
            items: [
                '<strong>Business Casual</strong> \u2014 Office-based, non-client-facing. Colored shirts, khakis, kaftans OK',
                '<strong>Business Professional</strong> \u2014 Client-facing. Conservative suits, ties required, closed-toe shoes',
                '<strong>Male Formal</strong> \u2014 Navy/dark suits, collared shirts (white/blue/pink), oxfords/loafers',
                '<strong>Female Formal</strong> \u2014 Neutral suit/skirt+jacket, closed-toe pumps, skirts max 2 above knee',
                '<strong>Not Allowed</strong> \u2014 Jeans, tracksuits, flip-flops, sport shoes, mini dresses, ripped clothing',
                '<strong>Grooming</strong> \u2014 Neat hair, modest makeup, no nail art. Hijabs permitted (solid colors)',
                '<strong>Enforcement</strong> \u2014 1st=Verbal Warning, 2nd=1st Warning Letter, 3rd=2nd Warning Letter'
            ],
            action: 'Read Dress Code \u2192'
        }
    },
    {
        id: 'leave',
        keywords: ['leave', 'vacation', 'time off', 'annual leave', 'day off', 'leave days', 'leave entitlement', 'absence'],
        response: "Here is the complete leave policy at Coronation X.",
        card: {
            icon: '\u{1F3D6}\uFE0F', iconClass: 'teal', title: 'Leave Policy Overview',
            items: [
                '<strong>Analyst</strong> \u2014 20 working days (4 weeks) per year',
                '<strong>Executive</strong> \u2014 30 working days (6 weeks) per year',
                '<strong>Eligibility</strong> \u2014 Confirmed employees only (after 6-month probation)',
                '<strong>80% Rule</strong> \u2014 Must take at least 80% of leave before year-end',
                '<strong>Carryover</strong> \u2014 Outstanding must be used by March 31 or forfeited',
                '<strong>Notice</strong> \u2014 2-week notice to supervisor required',
                '<strong>Other</strong> \u2014 Sick, Compassionate (5 days), Maternity (4 months), Paternity (10 days), Exam (10 days)'
            ],
            action: 'Apply for Leave \u2192'
        }
    },
    {
        id: 'maternity',
        keywords: ['maternity', 'pregnancy', 'pregnant', 'baby', 'childbirth', 'nursing', 'adoption', 'surrogacy', 'miscarriage', 'stillborn'],
        response: "Coronation X provides comprehensive maternity support.",
        card: {
            icon: '\u{1F476}', iconClass: 'green', title: 'Maternity Leave',
            items: [
                '<strong>Duration</strong> \u2014 4 months on full pay (confirmed employees)',
                '<strong>Timing</strong> \u2014 At least 4 weeks before birth + 12 weeks after',
                '<strong>Pay</strong> \u2014 100% salary. All benefits remain intact',
                '<strong>Adoption</strong> \u2014 14 weeks maternity leave',
                '<strong>Surrogacy</strong> \u2014 Same maternity policy applies',
                '<strong>Miscarriage/Stillborn</strong> \u2014 8 weeks leave (3rd trimester)',
                '<strong>Nursing</strong> \u2014 Close 1 hour early for 3 months post-natal',
                '<strong>Spacing</strong> \u2014 18 months between maternity leaves (50% pay if overlapping)'
            ],
            action: 'Start Maternity Leave \u2192'
        }
    },
    {
        id: 'paternity',
        keywords: ['paternity', 'father', 'dad', 'paternity leave'],
        response: "Paternity leave at Coronation X.",
        card: {
            icon: '\u{1F468}\u200D\u{1F476}', iconClass: 'teal', title: 'Paternity Leave',
            items: [
                '<strong>Duration</strong> \u2014 10 days paid leave',
                '<strong>Timing</strong> \u2014 Must be taken within 3 months of birth',
                '<strong>Eligibility</strong> \u2014 Confirmed staff only',
                '<strong>Note</strong> \u2014 Welfare package, cannot be commuted to cash'
            ],
            action: 'Apply for Paternity Leave \u2192'
        }
    },
    {
        id: 'compassionate',
        keywords: ['compassionate', 'bereavement leave', 'funeral', 'death leave', 'emergency leave', 'loss'],
        response: "Compassionate leave is available for emergencies and loss.",
        card: {
            icon: '\u{1F54A}\uFE0F', iconClass: 'teal', title: 'Compassionate Leave',
            items: [
                '<strong>Duration</strong> \u2014 Up to 5 days',
                '<strong>Eligible Events</strong> \u2014 Sudden emergencies or loss of immediate family',
                '<strong>Immediate Family</strong> \u2014 Father, mother, children, siblings only',
                '<strong>Note</strong> \u2014 Separate from bereavement support payment (\u20A610,000)'
            ],
            action: 'Request Compassionate Leave \u2192'
        }
    },
    {
        id: 'absence',
        keywords: ['unauthorized', 'absent', 'absence', 'awol', 'abscondment', 'no show', 'unauthorized absence'],
        response: "Coronation X has strict policies on unauthorized absence.",
        card: {
            icon: '\u{1F6A8}', iconClass: 'red', title: 'Absence Policy',
            items: [
                '<strong>Authorized</strong> \u2014 Away with proper notification to line manager',
                '<strong>Unauthorized</strong> \u2014 Without leave, cause, or notification = unpaid leave',
                '<strong>Abscondment</strong> \u2014 Absent without cause for up to 1 month = Dismissal',
                '<strong>HR Notification</strong> \u2014 Line Manager must notify HR immediately',
                '<strong>Notice Period</strong> \u2014 Unauthorized absence during notice = unpaid + disciplinary'
            ],
            action: 'Contact HR \u2192'
        }
    },
    {
        id: 'exit',
        keywords: ['resign', 'resignation', 'quit', 'notice', 'exit', 'leaving', 'termination', 'retirement', 'dismissal', 'handover', 'last day'],
        response: "Here are the exit management policies at Coronation X.",
        card: {
            icon: '\u{1F4DD}', iconClass: 'orange', title: 'Exit Management',
            items: [
                '<strong>Resignation</strong> \u2014 1 month notice or 1 month basic in lieu (2 months for management)',
                '<strong>Unconfirmed</strong> \u2014 2 weeks basic salary in lieu',
                '<strong>Retirement</strong> \u2014 Age 60 or 35 years service (whichever first)',
                '<strong>Dismissal</strong> \u2014 For gross misconduct, MD/CEO approval required. No benefits except pension',
                '<strong>Leave</strong> \u2014 Outstanding days monetized as exit benefits (cannot offset notice)',
                '<strong>Handover</strong> \u2014 Detailed note required 1 week before exit. Inadequate = entitlements delayed'
            ],
            action: 'Start Exit Process \u2192'
        }
    },
    {
        id: 'disciplinary',
        keywords: ['disciplinary', 'warning', 'misconduct', 'gross misconduct', 'fired', 'sacked', 'fraud', 'stealing', 'theft', 'sanction', 'query', 'suspension', 'dismissal', 'dc', 'committee', 'appeal', 'caution', 'terminated'],
        response: "Coronation X has a detailed progressive disciplinary framework.",
        card: {
            icon: '\u2696\uFE0F', iconClass: 'red', title: 'Disciplinary Policy',
            items: [
                '<strong>3 Tiers</strong> \u2014 Minor (outside DC), Major (DC hearing), Gross (DC + may = Summary Dismissal)',
                '<strong>Minor</strong> \u2014 Dress code, lateness, attitude \u2192 Verbal Warning \u2192 1st Warning \u2192 2nd Warning',
                '<strong>Major</strong> \u2014 Unauthorized absence, insubordination, abuse of office \u2192 Final Warning/Suspension/Termination',
                '<strong>Gross</strong> \u2014 Fraud, theft, harassment, weapons, falsification \u2192 Termination or Summary Dismissal',
                '<strong>DC</strong> \u2014 EXCO Chair + Line Manager + HR + Internal Audit. 48-hour notice to employee',
                '<strong>Appeal</strong> \u2014 Within 5 working days to MD/CEO-chaired Appeal Committee',
                '<strong>Impact</strong> \u2014 Sanctions deduct 1\u20135% from appraisal. Suspension = no promotion that year',
                '<strong>Fraud Suspension</strong> \u2014 No pay. If exonerated, salary refunded with MPR+200bp interest'
            ],
            action: 'Read Disciplinary Code \u2192'
        }
    },
    {
        id: 'remote',
        keywords: ['remote', 'work from home', 'wfh', 'hybrid', 'off premises', 'on premises', 'remote work'],
        response: "Coronation X operates a hybrid work model.",
        card: {
            icon: '\u{1F3E0}', iconClass: 'teal', title: 'Remote Work Policy',
            items: [
                '<strong>Structure</strong> \u2014 Hybrid: on-premises + off-premises combination',
                '<strong>Tools</strong> \u2014 Company provides laptops, internet, phones. All remain company property',
                '<strong>Personal Devices</strong> \u2014 Allowed but must be validated by IT first',
                '<strong>Security</strong> \u2014 No public Wi-Fi. Hard disk encryption required. Separate room recommended',
                '<strong>Conduct</strong> \u2014 Professional for virtual meetings. Cameras on for interviews',
                '<strong>Performance</strong> \u2014 Measured by outcomes using Performance Management process',
                '<strong>Protection</strong> \u2014 Cannot be terminated for working remotely (except gross misconduct)'
            ],
            action: 'Learn More \u2192'
        }
    },
    {
        id: 'whistleblowing',
        keywords: ['whistle', 'whistleblowing', 'whistleblower', 'report misconduct', 'malpractice', 'anonymous report'],
        response: "Coronation X encourages reporting of malpractice with full protection.",
        card: {
            icon: '\u{1F4E2}', iconClass: 'green', title: 'Whistleblowing Policy',
            items: [
                '<strong>Purpose</strong> \u2014 Encourage disclosure of malpractice/misconduct',
                '<strong>Protection</strong> \u2014 Against discharge, demotion, suspension, harassment, discrimination',
                '<strong>Scope</strong> \u2014 All employees, contractors, suppliers, stakeholders',
                '<strong>Examples</strong> \u2014 Criminal offence, fraud, misrepresentation, safety dangers, concealment',
                '<strong>Note</strong> \u2014 Failure to whistleblow = Major Misconduct (Suspension \u2192 Termination)'
            ],
            action: 'Report Malpractice \u2192'
        }
    },
    {
        id: 'grievance',
        keywords: ['grievance', 'complaint', 'unfair', 'dispute', 'problem', 'dissatisfied'],
        response: "Coronation X has a structured 3-step grievance procedure.",
        card: {
            icon: '\u{1F4DD}', iconClass: 'orange', title: 'Grievance Procedure',
            items: [
                '<strong>Step 1</strong> \u2014 Discuss with Line Manager. If unresolved, write to Supervisor',
                '<strong>Step 2</strong> \u2014 Escalate to Head of Division in writing within 7 days',
                '<strong>Step 3</strong> \u2014 Appeal to MD/CEO in writing within 7 days. HR arranges interview. Decision is final',
                '<strong>Companion</strong> \u2014 You may bring a work colleague to any hearing',
                '<strong>Goal</strong> \u2014 Open, prompt, fair, and frank resolution'
            ],
            action: 'Submit Grievance \u2192'
        }
    },
    {
        id: 'property',
        keywords: ['company property', 'laptop', 'phone', 'equipment', 'id card', 'intellectual property', 'removal', 'property'],
        response: "Company property policies at Coronation X.",
        card: {
            icon: '\u{1F4BB}', iconClass: 'amber', title: 'Company Property',
            items: [
                '<strong>Ownership</strong> \u2014 All equipment (laptops, phones, cards) = company property',
                '<strong>Care</strong> \u2014 Employee responsible for loss/damage due to negligence',
                '<strong>Surcharge</strong> \u2014 May be charged for damage/loss of property',
                '<strong>Removal</strong> \u2014 No property removed without express official permit',
                '<strong>Unauthorized Removal</strong> \u2014 Treated as theft',
                '<strong>IP</strong> \u2014 All work created during employment = solely company property'
            ],
            action: 'Read Property Policy \u2192'
        }
    },
    {
        id: 'health_safety',
        keywords: ['health', 'safety', 'fire', 'weapon', 'accident', 'pandemic', 'hygiene', 'sanitation', 'emergency', 'fire drill'],
        response: "Health and safety policies at Coronation X.",
        card: {
            icon: '\u{1F6E1}\uFE0F', iconClass: 'green', title: 'Health & Safety',
            items: [
                '<strong>Weapons</strong> \u2014 No firearms or dangerous weapons on premises',
                '<strong>Pandemics</strong> \u2014 HR assesses level, business continuity activated if needed',
                '<strong>Safety</strong> \u2014 Drive safely, seatbelts, switch off appliances after hours',
                '<strong>Fire</strong> \u2014 Equipment positioned at various points. Mandatory fire drills',
                '<strong>False Alarm</strong> \u2014 Deliberately false fire alarm = disciplinary action',
                '<strong>Hygiene</strong> \u2014 High standard required. Hand sanitizers provided'
            ],
            action: 'View Safety Guidelines \u2192'
        }
    },
    {
        id: 'email',
        keywords: ['email', 'internet', 'communications', 'social media', 'all staff', 'e-mail', 'electronic'],
        response: "Email, internet, and communications policies.",
        card: {
            icon: '\u{1F4E7}', iconClass: 'teal', title: 'Email & Communications',
            items: [
                '<strong>Ownership</strong> \u2014 All email messages = company property',
                '<strong>Privacy</strong> \u2014 Not guaranteed even with private passwords',
                '<strong>Personal Use</strong> \u2014 Not allowed during official hours',
                '<strong>All Staff Email</strong> \u2014 Restricted to HR, Marketing, MD/CEO only',
                '<strong>Signatures</strong> \u2014 Must use approved email signature per Marketing guidelines',
                '<strong>Prohibited</strong> \u2014 Harassment, chain letters, personal business, confidential info sharing'
            ],
            action: 'Read Communications Policy \u2192'
        }
    },
    {
        id: 'holidays',
        keywords: ['holiday', 'holidays', 'public holiday', 'company holiday', 'calendar'],
        response: "Coronation X observes public holidays and provides leave allowances.",
        card: {
            icon: '\u{1F4C5}', iconClass: 'teal', title: 'Public Holidays',
            items: [
                '<strong>Public Holidays</strong> \u2014 If a public holiday falls during leave, extra days taken in lieu',
                '<strong>Leave Allowance</strong> \u2014 Paid when employee proceeds on leave (min 10 days utilized)'
            ],
            action: 'View Calendar \u2192'
        }
    },
    {
        id: 'greeting',
        keywords: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'greetings', 'welcome'],
        response: "Hello! \u{1F44B} Welcome to the **Coronation X Limited** HR Assistant.\n\nHow may I assist you today? \n\nI can also handle **\u201Cwhat if\u201D scenarios** \u2014 try asking:\n*\u201CWhat if I fail probation?\u201D*\n*\u201CWhat if two employees get married?\u201D*",
        card: null
    },
    {
        id: 'help',
        keywords: ['help', 'support', 'assist', 'what can you do', 'options', 'menu', 'start'],
        response: "I cover all **Coronation X Limited** policies:\n\n\u{1F4D6} Employee Handbook & Employment\n\u{1F6E1}\uFE0F Code of Conduct & Ethics\n\u{1F4B0} Total Rewards & Compensation\n\u{1F4CA} Performance Management\n\u{1F4DA} Learning & Development\n\u{1F454} Dress Code\n\u{1F3D6}\uFE0F Leave Policy\n\u2696\uFE0F Disciplinary & Exit Management\n\u{1F6AB} Harassment Policy\n\u{1F4E2} Whistleblowing & Grievance\n\u{1F3E0} Remote Work\n\nAsk any question, or try a **\u201Cwhat if\u201D** scenario!",
        card: null
    },
    {
        id: 'thanks',
        keywords: ['thank', 'thanks', 'appreciate', 'cheers', 'helpful', 'great', 'awesome'],
        response: "You\u2019re welcome! \u{1F60A} If you need anything else about Coronation X policies, I\u2019m always here.",
        card: null
    },
    {
        id: 'contact',
        keywords: ['contact', 'hr', 'phone', 'reach', 'speak to', 'talk to', 'human', 'person', 'agent', 'human resources', 'royal', 'timilehin', 'email', 'call'],
        response: "Need further assistance? Reach out to our HR team directly.",
        card: {
            icon: '\u{1F4DE}', iconClass: 'amber', title: 'Contact HR Team',
            items: [
                '<strong>Royal</strong> \u2014 oloturoyal@gmail.com | 09132304305',
                '<strong>Timilehin</strong> \u2014 ajibolatimilehindavid@gmail.com | 0911 836 0376',
                '<strong>Office</strong> \u2014 10, Amodu Ojikutu Street, Victoria Island, Lagos',
                '<strong>Note</strong> \u2014 For any policy questions I cannot answer, please contact Royal or Timilehin directly'
            ],
            action: 'Reach Out Now \u2192'
        }
    }
];

const fallbacks = [
    "I don\u2019t have specific information on that topic. Please reach out to **Royal** (oloturoyal@gmail.com | 09132304305) or **Timilehin** (ajibolatimilehindavid@gmail.com | 0911 836 0376) for further assistance.",
    "I couldn\u2019t match that to a specific policy. Try asking about **leave**, **performance**, **salary**, **dress code**, **disciplinary**, or **maternity**. Or contact **Royal** (09132304305) or **Timilehin** (0911 836 0376) directly.",
    "That\u2019s a great question, but it\u2019s outside my current knowledge base. Please contact **Royal** at oloturoyal@gmail.com or **Timilehin** at ajibolatimilehindavid@gmail.com for guidance."
];


// ================================================================
//  RESPONSE MATCHING
// ================================================================

function findStaticResponse(input) {
    const lower = input.toLowerCase().trim();
    let best = null, bestScore = 0;
    for (const entry of knowledgeBase) {
        let score = 0;
        for (const kw of entry.keywords)
            if (lower.includes(kw)) score += kw.length + (kw.split(' ').length > 1 ? 5 : 0);
        if (score > bestScore) { bestScore = score; best = entry; }
    }
    if (best) return { ...best, score: bestScore, isFallback: false };
    return { response: fallbacks[Math.floor(Math.random() * fallbacks.length)], card: null, score: 0, isFallback: true };
}


// ================================================================
//  UTILITIES
// ================================================================

function getTimestamp() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

function fmt(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

function scrollToBottom() {
    requestAnimationFrame(() => chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' }));
}

function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }


// ================================================================
//  MESSAGE RENDERING (No suggestions, no feedback buttons)
// ================================================================

function addUserMessage(text) {
    const g = document.createElement('div');
    g.className = 'msg-group user';
    g.innerHTML = `<div class="msg-avatar">👤</div><div class="msg-content"><div class="msg-bubble">${escapeHtml(text)}</div><div class="msg-meta"><span class="msg-time">${getTimestamp()}</span></div></div>`;
    chatMessages.appendChild(g); scrollToBottom();
}

function addBotMessage(text, card = null) {
    const g = document.createElement('div');
    g.className = 'msg-group bot';
    let ch = '';
    if (card) ch = `<div class="info-card"><div class="info-card-header"><div class="info-card-icon ${card.iconClass}">${card.icon}</div>${card.title}</div><div class="info-card-body"><ul>${card.items.map(i => `<li>${i}</li>`).join('')}</ul></div><div class="info-card-action"><button>${card.action}</button></div></div>`;
    g.innerHTML = `<div class="msg-avatar">🏢</div><div class="msg-content"><div class="msg-bubble">${fmt(text)}</div>${ch}<div class="msg-meta"><span class="msg-time">${getTimestamp()}</span></div></div>`;
    chatMessages.appendChild(g); playPop(); scrollToBottom();
}

function showTyping() {
    const el = document.createElement('div'); el.className = 'typing-group'; el.id = 'typingIndicator';
    el.innerHTML = `<div class="msg-avatar">🏢</div><div class="typing-bubble"><div class="typing-dots"><span></span><span></span><span></span></div><span class="typing-label">CX HR is typing</span></div>`;
    chatMessages.appendChild(el); scrollToBottom();
}

function hideTyping() { const el = document.getElementById('typingIndicator'); if (el) el.remove(); }

function addDateSeparator() {
    const s = document.createElement('div'); s.className = 'date-separator';
    s.innerHTML = `<span>${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</span>`;
    chatMessages.appendChild(s);
}


// ================================================================
//  SMART ROUTER — Fully Local, No API
//  1. Always check KB first
//  2. If KB has a match: use it
//  3. If question looks like "what if": use consequence engine
//  4. If neither: show fallback message
// ================================================================

function setInputEnabled(on) { chatInput.disabled = !on; sendBtn.disabled = !on; if (on) chatInput.focus(); }
function updateSendBtn() { sendBtn.classList.toggle('active', chatInput.value.trim().length > 0); }

// Detect genuine what-if / scenario questions
const WHATIF_PATTERNS = [
    /what\s+if\s+/i,
    /what\s+happens?\s+if/i,
    /what\s+would\s+happen/i,
    /suppose\s+(i|we|an?\s+employee|someone|a\s+staff)/i,
    /can\s+i\s+be\s+(fired|terminated|dismissed|sacked|suspended)/i,
    /will\s+i\s+(be|get)\s+(fired|terminated|warned|punished|disciplined|dismissed|sacked|suspended)/i,
    /if\s+i\s+(don'?t|do\s+not|refuse|fail|skip|miss|forget|can'?t|won'?t|didn'?t|leave\s+without|resign\s+without|take\s+unauthorized)/i,
    /what\s+should\s+i\s+do\s+if/i,
    /what\s+happens\s+(when|after|if)\s+(i|an?\s+employee|someone|my|you|a\s+staff)/i,
    /what\s+are\s+the\s+consequences/i,
    /let'?s\s+say/i,
    /hypothetically/i,
    /imagine\s+if/i,
];

function isWhatIf(input) {
    return WHATIF_PATTERNS.some(p => p.test(input.toLowerCase().trim()));
}

async function handleUserMessage(text) {
    const t = text.trim();
    if (!t || isBotTyping) return;
    addUserMessage(t); playTick();
    chatInput.value = ''; updateSendBtn();
    isBotTyping = true; setInputEnabled(false);

    // Step 1: Find best KB match
    const staticResult = findStaticResponse(t);

    // Step 2: Check if this is a "what if" question
    const whatIf = isWhatIf(t);

    // Step 3: If it's a what-if, try the consequence engine first
    let response = null;
    if (whatIf) {
        response = getWhatIfResponse(t);
    }

    const delay = 500 + Math.random() * 600;
    showTyping();
    await new Promise(res => setTimeout(res, delay));
    hideTyping();

    if (response) {
        // What-if engine found a policy-based answer
        addBotMessage(response, null);
    } else if (!staticResult.isFallback) {
        // KB has a solid match — use it with its card
        addBotMessage(staticResult.response, staticResult.card);
    } else {
        // Neither what-if nor KB matched — show fallback
        addBotMessage(staticResult.response, null);
    }

    isBotTyping = false; setInputEnabled(true);
}


// ================================================================
//  EVENT LISTENERS
// ================================================================

sendBtn.addEventListener('click', () => handleUserMessage(chatInput.value));
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleUserMessage(chatInput.value); } });
chatInput.addEventListener('input', updateSendBtn);
// categoryBar.addEventListener('click', e => { const c = e.target.closest('.category-chip'); if (c) handleUserMessage(c.dataset.topic); });

startBtn.addEventListener('click', () => {
    welcomeOverlay.classList.add('hidden'); playPop();
    setTimeout(() => {
        addDateSeparator();
        setTimeout(() => {
            addBotMessage("Welcome to **Coronation X Limited** HR Assistant! 👋\n\nHow may I assist you today?\n\n", null);
        }, 300);
    }, 400);
});

function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    themeToggle.textContent = t === 'dark' ? '☀️' : '🌙';
    themeToggle.title = t === 'dark' ? 'Light mode' : 'Dark mode';
    localStorage.setItem('coronationx-theme', t);
}

themeToggle.addEventListener('click', () => { playTick(); const c = document.documentElement.getAttribute('data-theme'); setTheme(c === 'dark' ? 'light' : 'dark'); });

// soundToggle.addEventListener('click', () => {
//     soundEnabled = !soundEnabled;
//     soundToggle.classList.toggle('active', soundEnabled);
//     soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
//     soundToggle.title = soundEnabled ? 'Mute' : 'Enable sounds';
//     if (soundEnabled) playTick();
// });

(function init() {
    const s = localStorage.getItem('coronationx-theme');
    if (s) setTheme(s); else setTheme('dark');
    chatInput.focus(); updateSendBtn();
})();
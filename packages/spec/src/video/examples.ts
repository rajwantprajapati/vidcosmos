// One valid scene for each of the 12 templates, with narration its triggers come from. Used
// by tests here, and as sample content for template previews and stories later.
import type { SceneInput } from "./schema.ts";
import type { TemplateName } from "./templates.ts";

export const exampleScenes: { [T in TemplateName]: Extract<SceneInput, { template: T }> } = {
  title: {
    id: "sc_title001",
    template: "title",
    narration: "You tap Pay, and in two seconds your friend has the money. Let's follow it.",
    content: {
      heading: "How UPI moves your money",
      headingTrigger: "You tap Pay",
      subheading: "Three hops in two seconds",
      subheadingTrigger: "follow it",
      icon: "Smartphone",
    },
  },
  bullets: {
    id: "sc_bullets1",
    template: "bullets",
    narration: "You need three things: a bank account, a phone number, and a UPI app.",
    content: {
      heading: "What you need",
      items: [
        { text: "A bank account", icon: "Building2", trigger: "bank account" },
        { text: "A phone number", icon: "Phone", trigger: "phone number" },
        { text: "A UPI app", icon: "Smartphone", trigger: "UPI app" },
      ],
    },
  },
  keyTerm: {
    id: "sc_keyterm1",
    template: "keyTerm",
    narration: "NPCI is the network that connects every bank in India.",
    content: {
      term: "NPCI",
      termTrigger: "NPCI",
      definition: "National Payments Corporation of India: the network that connects every bank.",
      definitionTrigger: "the network",
      icon: "Globe",
    },
  },
  flowchart: {
    id: "sc_flow0001",
    template: "flowchart",
    narration: "Your app sends the request to NPCI, NPCI asks their bank, and the bank says yes.",
    content: {
      heading: "Three hops",
      layout: "linear",
      steps: [
        { label: "Your app", icon: "Smartphone", trigger: "Your app" },
        { label: "NPCI", icon: "Globe", trigger: "to NPCI" },
        { label: "Their bank", icon: "Building2", trigger: "their bank" },
      ],
    },
  },
  comparison: {
    id: "sc_compare1",
    template: "comparison",
    narration: "Cash needs change and a trip to the ATM. UPI needs only your phone and a PIN.",
    content: {
      heading: "Cash or UPI",
      left: {
        title: "Cash",
        icon: "Banknote",
        titleTrigger: "Cash",
        points: [
          { text: "Needs change", trigger: "needs change" },
          { text: "ATM trips", trigger: "the ATM" },
        ],
      },
      right: {
        title: "UPI",
        icon: "Smartphone",
        titleTrigger: "UPI needs",
        points: [
          { text: "Just your phone", trigger: "your phone" },
          { text: "A PIN", trigger: "a PIN" },
        ],
      },
    },
  },
  timeline: {
    id: "sc_timeline",
    template: "timeline",
    narration:
      "UPI launched in 2016, crossed a billion payments a month in 2019, and ten billion in 2023.",
    content: {
      heading: "UPI over the years",
      events: [
        { date: "2016", label: "UPI launches", trigger: "launched in 2016" },
        { date: "2019", label: "1 billion a month", trigger: "in 2019" },
        { date: "2023", label: "10 billion a month", trigger: "in 2023" },
      ],
    },
  },
  barChart: {
    id: "sc_barchart",
    template: "barChart",
    narration: "Most payments are small: groceries first, then bills, then travel.",
    content: {
      heading: "What people pay for",
      unit: "%",
      bars: [
        { label: "Groceries", value: 46, trigger: "groceries" },
        { label: "Bills", value: 31, trigger: "bills" },
        { label: "Travel", value: 23, trigger: "travel" },
      ],
      source: "Example figures",
    },
  },
  pieChart: {
    id: "sc_piechart",
    template: "pieChart",
    narration: "Phones make most payments, and computers make the rest.",
    content: {
      heading: "Where payments start",
      slices: [
        { label: "Phones", value: 85, trigger: "Phones" },
        { label: "Computers", value: 15, trigger: "computers" },
      ],
    },
  },
  iconGrid: {
    id: "sc_icongrid",
    template: "iconGrid",
    narration: "Pay for food, travel, bills and shopping with the same app.",
    content: {
      heading: "One app for everything",
      items: [
        { icon: "ShoppingCart", label: "Food", trigger: "food" },
        { icon: "Train", label: "Travel", trigger: "travel" },
        { icon: "Wallet", label: "Bills", trigger: "bills" },
        { icon: "Store", label: "Shopping", trigger: "shopping" },
      ],
    },
  },
  statCallout: {
    id: "sc_statcall",
    template: "statCallout",
    narration: "Over ten billion payments a month go through UPI.",
    content: {
      value: "10 billion",
      valueTrigger: "ten billion",
      label: "UPI payments every month",
      labelTrigger: "a month",
      icon: "TrendingUp",
      source: "Example figure",
    },
  },
  quiz: {
    id: "sc_quiz0001",
    template: "quiz",
    narration:
      "Quick question: who sees your PIN? Your bank, the shop, or nobody? The answer is nobody.",
    content: {
      question: "Who sees your UPI PIN?",
      questionTrigger: "who sees your PIN",
      options: [
        { text: "Your bank", trigger: "Your bank" },
        { text: "The shop", trigger: "the shop" },
        { text: "Nobody", trigger: "or nobody" },
      ],
      answerIndex: 2,
      reveal: { trigger: "The answer" },
    },
  },
  recap: {
    id: "sc_recap001",
    template: "recap",
    narration: "So remember: three hops, two seconds, and a PIN only you know. Try it today.",
    content: {
      heading: "Remember",
      points: [
        { text: "Three hops", trigger: "three hops" },
        { text: "Two seconds", trigger: "two seconds" },
        { text: "A PIN only you know", trigger: "a PIN" },
      ],
      cta: "Try it today",
      ctaTrigger: "Try it today",
    },
  },
};

import sourceRepository from "./source-repository.json";
import portrait from "../assets/images/mahad-profile.jpg";

export type Link = {
  label: string;
  href: string;
  external?: boolean;
};

export const identity = {
  firstName: "Mahad",
  fullName: "Muhammad Mahad",
  nameUrdu: "مہد",
} as const;

export const site = {
  ...identity,
  name: `${identity.firstName}/${identity.nameUrdu}`,
  url: "https://www.mmahad.com",
  sourceRepositoryUrl: sourceRepository.url,
  sourceRepositoryPublic: sourceRepository.public,
  sourceRepositoryBranch: sourceRepository.branch,
  description: "Open-source enthusiast, scientist, engineer, teacher (in that order).",
  favicon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🐸</text></svg>',
  socialImage: {
    src: "/images/mahad-profile.jpg",
    alt: "Muhammad Mahad standing beside a mountain lake",
    width: portrait.width,
    height: portrait.height,
  },
} as const;

export const pageDescriptions = {
  about: site.description,
  openSource:
    "I am passionate about contributing to open-source software and have been actively involved in various projects, including major contributions through Google Summer of Code.",
  teaching:
    "I am passionate about education and have been involved in teaching and mentoring students in formal academic settings and through community initiatives.",
  volunteering:
    "I am passionate about giving back to the tech community through workshops, mentorship, community building, and events I have organized.",
  education: "My Computer Science education at FAST NUCES, together with audited courses, certifications, books, and open course resources.",
  contact: "Feel free to reach out to discuss open-source projects, collaboration opportunities, or questions.",
} as const;

export const navigation = [
  { label: "about", href: "/" },
  { label: "open-source", href: "/open-source/" },
  { label: "teaching", href: "/teaching/" },
  { label: "volunteering", href: "/volunteering/" },
  { label: "education", href: "/education/" },
  { label: "blog", href: "/blog/" },
  { label: "notes", href: "/notes/" },
  { label: "contact", href: "/contact/" },
] as const;

export const githubContributionsUrl = "https://github.com/search?q=is%3Apr+author%3AMahadMuhammad+archived%3Afalse&type=pullrequests";

export const about = {
  subtitle: "open-source enthusiast, scientist, engineer, teacher (in that order)",
  profileImage: "/images/mahad-profile.jpg",
  profileFacts: [
    "Embedded Machine Learning Engineer @ Obvio.ai",
    "Google Summer of Code 2023 & 2024 @ GNU GCC",
    "Teaching underprivileged students",
    "Advocating open-source tech culture in Pakistan",
    "CS Grad from FAST NUCES",
  ],
} as const;

export const contactProfiles = [
  {
    icon: "email",
    label: "Email",
    title: "Email",
    value: "mahad@mmahad.com",
    href: "mailto:mahad@mmahad.com",
    external: false,
  },
  {
    icon: "github",
    label: "GitHub",
    title: "GitHub",
    value: "@MahadMuhammad",
    href: "https://github.com/MahadMuhammad",
    external: true,
  },
  {
    icon: "linkedin",
    label: "LinkedIn",
    title: "LinkedIn",
    value: "@mmahad",
    href: "https://www.linkedin.com/in/mmahad",
    external: true,
  },
  {
    icon: "x",
    label: "X",
    title: "X (Twitter)",
    value: "@_mmahad",
    href: "https://x.com/_mmahad",
    external: true,
  },
  {
    icon: "coursera",
    label: "Coursera",
    title: "Coursera",
    value: "Coursera Learner Profile",
    href: "https://www.coursera.org/learner/mahad",
    external: true,
  },
] as const;

export const portfolioContact = {
  message: "Feel free to reach out, would love to discuss new problems.",
  links: contactProfiles.map(({ icon, label, href, external }) => ({ icon, label, href, external })),
} as const;

export const openSourceProjects = [
  {
    title: "Rustc Testsuite Adapter for GCC Rust (GCCRS)",
    href: "https://summerofcode.withgoogle.com/archive/2024/projects/KVAetUOC",
    organization: "GNU Compiler Collection (GCC)",
    organizationHref: "https://gcc.gnu.org/",
    date: "Google Summer of Code 2024",
    image: "/images/gccrs-logo.png",
    imageAlt: "GCC Rust Logo",
    description:
      "My Google Summer of Code 2024 project involved creating a test suite adapter to run official rustc test cases on GCC Rust. Since rustc uses a different testing framework called Compiletest, I developed a command-line tool in Rust, rusttest-to-dg, to parse rustc test cases and convert them into a format compatible with GCC's DejaGNU testing framework.",
    impact:
      "This tool enables the GCC Rust project to leverage the comprehensive rustc test suite, significantly improving test coverage and ensuring compatibility with the official Rust compiler.",
    resources: [
      {
        label: "Compiletest",
        href: "https://rustc-dev-guide.rust-lang.org/tests/compiletest.html",
      },
      { label: "rusttest-to-dg", href: "https://github.com/Rust-GCC/rusttest-to-dg" },
      { label: "LWN coverage", href: "https://lwn.net/Articles/991199/" },
    ],
  },
  {
    title: "Improving user errors & Error Code Support for GCC Rust Frontend",
    href: "https://summerofcode.withgoogle.com/archive/2023/projects/PZbjvfZl",
    organization: "GNU Compiler Collection (GCC)",
    organizationHref: "https://gcc.gnu.org/",
    date: "Google Summer of Code 2023",
    image: "/images/gccrs-logo.png",
    imageAlt: "GCC Rust Logo",
    description:
      "My Google Summer of Code 2023 project focused on adding error code support to the GCC Rust frontend, aligning it with rustc, the official Rust compiler. This work improved the developer experience by providing consistent error messages and codes across different Rust compiler implementations.",
    impact:
      "Enhanced error reporting in GCC Rust, making it easier for developers to understand and fix compilation errors, and bringing GCC Rust closer to feature parity with rustc.",
    note: "I was the first student from my university campus to be selected for Google Summer of Code.",
    resources: [],
  },
] as const;

export const majorContributions: ReadonlyArray<Link> = [
  {
    label: "spcl/serverless-benchmarks at ETH Zürich",
    href: "https://github.com/spcl/serverless-benchmarks/pulls?q=is%3Apr+author%3AMahadMuhammad",
    external: true,
  },
  {
    label: "clang/iterator_checker/tests",
    href: "https://chromium-review.googlesource.com/c/chromium/src/+/5386708",
    external: true,
  },
  {
    label: "python/devguide",
    href: "https://github.com/python/devguide/pull/1250",
    external: true,
  },
  {
    label: "GoogleChrome/chrome-extensions-samples",
    href: "https://github.com/GoogleChrome/chrome-extensions-samples/pull/1350",
    external: true,
  },
];

export const teachingExperiences = [
  {
    title: "Teaching Assistant — CS4031: Compiler Construction",
    meta: "Spring 2025 | FAST NUCES",
    paragraphs: [
      "Assisted in teaching two computer science sections for the Compiler Construction course. Created comprehensive guidelines for FAST Lang, a programming language inspired by C, to help students understand compiler concepts. The language document guided students through building their own lexers and parsers, and then combining everything into a simple compiler.",
      "Key Contributions: Developed educational materials, provided hands-on guidance on compiler design principles, and helped students understand the complete compilation process from source code to executable.",
    ],
  },
  {
    title: "Lead Computer Science Instructor — AI and Digital Tools",
    meta: "Indonesia Zero Semester Project",
    paragraphs: [
      "Taught foundational AI concepts and digital productivity tools to underprivileged students as part of the Indonesia Zero Semester Project. This initiative helps prepare students for future academic study in Indonesia by providing essential technical skills and knowledge.",
      "The program is managed by the FAST NUCES International Education Office (IEO) and the Higher Education Commission (HEC) of Pakistan. This initiative is part of the Thrive Program by Alight and uses Coursera Instructor licenses provided by the Education Above All Foundation to support student learning and progress tracking.",
    ],
    resources: [
      {
        label: "FAST NUCES International Education Office (IEO)",
        href: "https://www.nu.edu.pk/international/Overview",
      },
      { label: "Alight", href: "https://www.wearealight.org" },
      {
        label: "Education Above All Foundation",
        href: "https://www.educationaboveall.org/",
      },
    ],
  },
] as const;

export const communityLeadership = [
  {
    title: "Techonix.pk",
    role: "Founder",
    date: "Oct 2023 - Jun 2025",
    description:
      "Founded Techonix.pk, a community dedicated to empowering students in open-source development. Our mission is to help students make their first open-source contributions and learn cutting-edge technologies. Since launching in October 2023, we've organized multiple workshops on open source and GitHub, reaching over 2,000 individuals across Pakistan.",
    links: [
      { label: "Instagram", href: "https://www.instagram.com/techonix.pk/" },
      {
        label: "LinkedIn",
        href: "https://www.linkedin.com/company/techonixpk/",
      },
    ],
    collaborators: [
      { label: "GDSC FAST, Lahore" },
      { label: "GDSC COMSATS Sahiwal" },
      { label: "DevHub Community", href: "https://www.instagram.com/realdevhub/" },
      { label: "GDSC COMSATS Lahore" },
      { label: "GDSC FAST, Peshawar" },
      { label: "GDSC Riphah University, Islamabad Campus" },
      { label: "GDSC Mohammad Ali Jinnah University" },
      {
        label: "GDSC CECOS University of Information Technology and Emerging Sciences, Peshawar",
      },
    ],
  },
  {
    title: "Microsoft Learn Student Ambassador",
    role: "Student Ambassador",
    date: "Jan 2024 - Aug 2025",
    description:
      "Selected as a Microsoft Learn Student Ambassador, a global program recognizing campus leaders who help fellow students, build tech communities, and develop technical and career skills. Through this role, I've organized technical workshops and events to foster learning and collaboration.",
    links: [],
    collaborators: [],
  },
] as const;

export const legacyWorkshops = [
  {
    title: "CodeFusion",
    meta: "Techonix Event | GDSC FAST Lahore",
    description: "A collaborative event focused on open-source development and community building.",
    links: [
      { label: "Instagram Reel", href: "https://www.instagram.com/p/CyitVIrrG9v/" },
      { label: "Post 1", href: "https://www.instagram.com/p/CyYc_bCtfhd/" },
      { label: "Post 2", href: "https://www.instagram.com/p/Cyas-SLNBAw/" },
      { label: "Post 3", href: "https://www.instagram.com/p/Cyca-vTIlNe/" },
    ],
  },
  {
    title: "GitHub Workshop",
    meta: "Techonix Event | GDSC FAST Lahore",
    description: "A comprehensive workshop covering GitHub fundamentals, version control, and collaborative development practices.",
    links: [{ label: "View on Instagram", href: "https://www.instagram.com/p/C0PW2qrtKif/" }],
  },
  {
    title: "Mastering GSoC",
    meta: "Techonix Event | GDSC COMSATS Lahore",
    description: "An in-depth session on Google Summer of Code, covering application strategies, proposal writing, and success tips.",
    links: [
      { label: "Post 1", href: "https://www.instagram.com/p/C0CnFpAMLYH/" },
      { label: "Post 2", href: "https://www.instagram.com/p/C0rShXwsU5J/?img_index=1" },
    ],
  },
  {
    title: "Google Summer of Code (GSoC)",
    meta: "Techonix Event | GDSC COMSATS Sahiwal, DevHub Community",
    description: "A collaborative workshop on Google Summer of Code, sharing insights and strategies for successful applications.",
    links: [
      {
        label: "View on Instagram",
        href: "https://www.instagram.com/p/CzyCZ5RN458/?img_index=1",
      },
    ],
  },
  {
    title: "Summer Code Crash: GSoC Challenge",
    meta: "Techonix Event | Multiple Collaborators",
    description:
      "A multi-university collaboration event focused on preparing students for Google Summer of Code applications through hands-on challenges and mentorship.",
    detail:
      "Collaborators: GDSC FAST Peshawar, GDSC Riphah International University (Islamabad Campus), GDSC CECOS University of Information Technology and Emerging Sciences, GDSC Mohammad Ali Jinnah University",
    links: [{ label: "View on Instagram", href: "https://www.instagram.com/p/C2QTDtPMkAx/" }],
  },
  {
    title: "GLI Event",
    meta: "January 28, 2025 | Multiple Collaborators",
    description:
      "A session where I shared my experience and tips as a Google Summer of Code 2023 and 2024 participant. The event focused on helping students understand the GSoC application process and providing strategies for success.",
    detail: "Collaborators: GDGoC FAST Peshawar Campus, Global Leaders Initiative FAST-NUCES, GDGoC Islamia College University Peshawar",
    links: [
      {
        label: "View on Instagram",
        href: "https://www.instagram.com/p/DFVe5iAI0P7/",
      },
    ],
  },
  {
    title: "Career Connect Society Event",
    meta: "Tech Innovation Session",
    description: "A session on tech innovation and success stories, including Google Summer of Code experiences and career development strategies.",
    links: [
      {
        label: "View on LinkedIn",
        href: "https://www.linkedin.com/posts/career-connect-society_techinnovation-successstory-googlesummerofcode-activity-7180366053649043456-cp8r/",
      },
    ],
  },
  {
    title: "GitHub Codespaces",
    meta: "Microsoft Learn Student Ambassador Event",
    description: "A workshop on GitHub Codespaces, demonstrating cloud-based development environments and collaborative coding workflows.",
    links: [],
  },
  {
    title: "GitHub Copilot 101",
    meta: "Microsoft Learn Student Ambassador Event",
    description: "An introductory session on GitHub Copilot, exploring AI-powered coding assistance and productivity tools for developers.",
    links: [],
  },
  {
    title: "GitHub Actions: Build Your Personal Website on GitHub Pages",
    meta: "Microsoft Learn Student Ambassador Event",
    description:
      "A hands-on workshop on automating website deployment using GitHub Actions and GitHub Pages, covering CI/CD workflows and best practices.",
    links: [],
  },
] as const;

export const education = {
  degree: {
    title: "BS - Computer Science",
    institution: "National University of Computer and Emerging Sciences",
    date: "Aug 2021 - June 2025",
  },
  certificates: [
    {
      title: "Build a Modern Computer from First Principles: Nand to Tetris Part I",
      provider: "The Hebrew University of Jerusalem",
      label: "Show credential",
      href: "https://www.coursera.org/account/accomplishments/certificate/RU43LJ4XH48Z",
    },
    {
      title: "Build a Modern Computer from First Principles: Nand to Tetris Part II",
      provider: "The Hebrew University of Jerusalem",
      label: "Show credential",
      href: "https://www.coursera.org/account/accomplishments/certificate/PM5YZFQXHB5C",
    },
    {
      title: "Compilers by Prof. Alex Aiken — Audited",
      provider: "edX — Stanford Online",
      label: "GitHub Repo",
      href: "https://github.com/MahadMuhammad/compilers-from-scratch",
    },
    {
      title: "Meta Front-End Developer Specialization",
      provider: "Meta",
      label: "Show credential",
      href: "https://www.coursera.org/account/accomplishments/specialization/certificate/LDS9BL89HQ5G",
    },
    {
      title: "Meta Back-End Developer Specialization",
      provider: "Meta",
      label: "Show credential",
      href: "https://www.coursera.org/account/accomplishments/specialization/certificate/DYAGC8QTVLDT",
    },
    {
      title: "Python for Everybody Specialization",
      provider: "University of Michigan",
      label: "Show credential",
      href: "https://www.coursera.org/account/accomplishments/specialization/certificate/MJGRC86LTP7E",
    },
    {
      title: "Machine Learning Specialization",
      provider: "DeepLearning.AI",
      label: "Show credential",
      href: "https://www.coursera.org/account/accomplishments/specialization/certificate/F39TLUJN2Z3C",
    },
    {
      title: "TensorFlow Developer Specialization",
      provider: "DeepLearning.AI",
      label: "Show credential",
      href: "https://www.coursera.org/account/accomplishments/specialization/certificate/KDDNWP4SBPC4",
    },
  ],
} as const;

export const contactChannels = contactProfiles.map(({ icon, title, value, href, external }) => ({
  icon,
  title,
  value,
  href,
  external,
}));

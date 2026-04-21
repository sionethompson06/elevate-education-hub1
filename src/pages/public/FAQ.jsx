import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/apiClient";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const DEFAULT_FAQS = [
  {
    id: "q1",
    question: "Is this a private school or homeschool program?",
    answer: "Elevate Performance Academy is a hybrid microschool. Students attend on-site three days per week (Monday, Tuesday, Thursday) with Wednesday dedicated to guided home learning. It is not a traditional private school, nor is it a fully independent homeschool — it's a structured hybrid that combines the best of both.",
  },
  {
    id: "q2",
    question: "Can students play sports for their local public school?",
    answer: "This depends on the policies of your local school district. Many districts in Oregon and other states allow homeschool or private school students to participate in public school athletics. We encourage families to check with their district directly. Our staff is happy to help navigate this question.",
  },
  {
    id: "q3",
    question: "Can athletes join the training program without academic enrollment?",
    answer: "Yes. The Athletic Performance Program is a standalone offering. Families can enroll a student exclusively in athletic training ($500/month) without any academic program. There are no academic prerequisites for athletic enrollment.",
  },
  {
    id: "q4",
    question: "How intense is the performance training?",
    answer: "Training is structured like a collegiate strength and conditioning program, scaled appropriately by age and development. Sessions run 60 minutes, four times per week, covering speed development, strength training, conditioning, injury prevention, sports nutrition, and mental performance. It is rigorous but accessible — athletes of all levels are welcome.",
  },
  {
    id: "q5",
    question: "Who are the trainers and coaches?",
    answer: "EPA employs certified strength and conditioning professionals plus a rotating network of guest instructors, including former NCAA Division I athletes, sports nutritionists, NIL attorneys, and professional coaches. Our academic coaches hold degrees in education and have experience in K–12 instruction.",
  },
  {
    id: "q6",
    question: "What grades do you serve?",
    answer: "The hybrid microschool and virtual homeschool support programs serve students in grades K–12. Athletic training is also available to all school-age athletes with age-appropriate programming and modifications.",
  },
  {
    id: "q7",
    question: "How many students are in each class?",
    answer: "Each classroom cohort has a maximum of 10 students, ensuring every student receives direct teacher attention and personalized instruction. The entire hybrid program has a total enrollment cap of 40 students to maintain the quality and culture of the program.",
  },
  {
    id: "q8",
    question: "What does Wednesday home learning look like?",
    answer: "Wednesday is a structured home learning day. Students receive guided activities and assignments that reinforce the week's on-site instruction in literacy, STEM, and writing. These activities are designed to take 2–4 hours and are sent home or digitally delivered each Tuesday. Parents serve as the primary support for their student on Wednesdays.",
  },
  {
    id: "q9",
    question: "Can students enroll mid-year?",
    answer: "Yes. EPA uses a rolling admissions model, subject to availability within each grade cohort. If space is available, students may begin enrollment at any point during the academic year. Contact our admissions team to check current openings.",
  },
];

export default function FAQ() {
  const [openId, setOpenId] = useState(null);

  const { data: allCms = [] } = useQuery({
    queryKey: ["cms-all-public"],
    queryFn: () => apiGet('/cms'),
  });

  const cmsFaqs = allCms.filter(r => r.section === "faq");
  const displayFaqs = cmsFaqs.length > 0
    ? cmsFaqs.map(f => ({ id: String(f.id), question: f.title || f.key, answer: f.body }))
    : DEFAULT_FAQS;

  return (
    <div className="bg-[#0A0F1A]">
      {/* Hero */}
      <section className="py-20 px-6 text-white border-b border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-mono tracking-widest text-[#3B82F6] uppercase mb-4">SUPPORT</p>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white mb-4">
            FREQUENTLY ASKED <span className="text-[#3B82F6]">QUESTIONS</span>
          </h1>
          <p className="text-slate-400">Find answers to the most common questions about EPA programs and enrollment.</p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto space-y-3">
          {displayFaqs.map(({ id, question, answer }) => (
            <div key={id} className="bg-[#1E293B] border border-white/5 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/5 transition-colors"
                onClick={() => setOpenId(openId === id ? null : id)}
              >
                <span className="font-semibold text-white text-sm pr-4">{question}</span>
                {openId === id
                  ? <ChevronUp className="w-4 h-4 text-[#3B82F6] shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                }
              </button>
              {openId === id && (
                <div className="px-6 pb-5 border-t border-white/5">
                  <p className="pt-4 text-sm text-slate-400 leading-relaxed">{answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

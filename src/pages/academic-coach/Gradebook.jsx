import { useLocation } from "react-router-dom";
import LessonBuilder from "@/components/gradebook/LessonBuilder";

export default function AcademicCoachGradebook() {
  const location = useLocation();
  const { initialPlan, savedLessonId } = location.state ?? {};
  return <LessonBuilder initialPlan={initialPlan} savedLessonId={savedLessonId} />;
}

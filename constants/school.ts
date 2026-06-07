import { AssessmentGroup, GradingScaleItem, ScoreComponent } from "../types";

export const TERMS = ["First Term", "Second Term", "Third Term"];

export const GRADES = ["JHS 1", "JHS 2", "JHS 3"];

export const STREAMS = ["A", "B", "C"];

export const SUBJECTS = [
  "English Language",
  "Mathematics",
  "Integrated Science",
  "Social Studies",
  "Computing",
  "Career Technology",
  "Creative Arts",
  "Religious and Moral Education",
];

export const SCORE_COMPONENTS: ScoreComponent[] = [
  { field: "CLASS TEST 1", label: "CLASS TEST 1", max: 15, group: "class_group" },
  { field: "CLASS TEST 2", label: "CLASS TEST 2", max: 15, group: "class_group" },
  { field: "GROUP WORK", label: "GROUP WORK", max: 10, group: "class_group" },
  { field: "PROJECT WORK", label: "PROJECT WORK", max: 20, group: "class_group" },
  { field: "EXAM SCORE", label: "EXAM SCORE", max: 100, group: "exam_group" },
];

export const ASSESSMENT_GROUPS: Record<string, AssessmentGroup> = {
  class_group: {
    name: "CLASS",
    weight: 50,
    components: ["CLASS TEST 1 (15)", "CLASS TEST 2 (15)", "GROUP WORK (10)", "PROJECT WORK (20)"],
  },
  exam_group: {
    name: "EXAMS",
    weight: 50,
    components: ["EXAM SCORE (100)"],
  },
};

export const GRADING_SCALE: GradingScaleItem[] = [
  { min: 90, max: 100, grade: 1, remark: "Excellent" },
  { min: 80, max: 89, grade: 2, remark: "Very Good" },
  { min: 70, max: 79, grade: 3, remark: "Good" },
  { min: 60, max: 69, grade: 4, remark: "High Average" },
  { min: 55, max: 59, grade: 5, remark: "Average" },
  { min: 50, max: 54, grade: 6, remark: "Low Average" },
  { min: 40, max: 49, grade: 7, remark: "Low" },
  { min: 35, max: 39, grade: 8, remark: "Lower" },
  { min: 0, max: 34, grade: 9, remark: "Lowest" },
];

export const CURRENT_YEAR = "2025/2026";

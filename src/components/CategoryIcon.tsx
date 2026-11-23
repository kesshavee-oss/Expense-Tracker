import React from 'react';
import {
  Utensils,
  ShoppingBasket,
  Bus,
  Plane,
  Home,
  Receipt,
  Zap,
  Repeat,
  GraduationCap,
  BookOpen,
  ShoppingBag,
  Stethoscope,
  HeartPulse,
  Sparkles,
  Dumbbell,
  TrendingUp,
  Shield,
  Film,
  Users,
  Gift,
  HeartHandshake,
  PawPrint,
  Wallet,
} from 'lucide-react';
import type { Category } from '../types';

interface CategoryMeta {
  bg: string;
  fg: string;
  bar: string;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const CATEGORY_META: Record<Category, CategoryMeta> = {
  Food: {
    bg: 'bg-[#FDECE8]',
    fg: 'text-[#A82813]',
    bar: 'bg-[#C83219]',
    Icon: Utensils,
  },
  Groceries: {
    bg: 'bg-[#EAF4E8]',
    fg: 'text-[#235920]',
    bar: 'bg-[#2E752A]',
    Icon: ShoppingBasket,
  },
  Transport: {
    bg: 'bg-[#E9F0F8]',
    fg: 'text-[#1E4B7A]',
    bar: 'bg-[#2C649E]',
    Icon: Bus,
  },
  Travel: {
    bg: 'bg-[#E6F2F5]',
    fg: 'text-[#145163]',
    bar: 'bg-[#1D718A]',
    Icon: Plane,
  },
  Rent: {
    bg: 'bg-[#F3ECE2]',
    fg: 'text-[#5C3D1E]',
    bar: 'bg-[#7A522B]',
    Icon: Home,
  },
  Bills: {
    bg: 'bg-[#FDF4E2]',
    fg: 'text-[#82520B]',
    bar: 'bg-[#B57414]',
    Icon: Receipt,
  },
  Utilities: {
    bg: 'bg-[#FEF3DB]',
    fg: 'text-[#7A4E08]',
    bar: 'bg-[#AD6E0B]',
    Icon: Zap,
  },
  Subscriptions: {
    bg: 'bg-[#ECEEF9]',
    fg: 'text-[#313B82]',
    bar: 'bg-[#4553B5]',
    Icon: Repeat,
  },
  Education: {
    bg: 'bg-[#EBEAF8]',
    fg: 'text-[#3D2C8D]',
    bar: 'bg-[#543EC2]',
    Icon: GraduationCap,
  },
  Study: {
    bg: 'bg-[#EEEAF8]',
    fg: 'text-[#4B328A]',
    bar: 'bg-[#6344B0]',
    Icon: BookOpen,
  },
  Shopping: {
    bg: 'bg-[#FCEBF2]',
    fg: 'text-[#912452]',
    bar: 'bg-[#B53169]',
    Icon: ShoppingBag,
  },
  Healthcare: {
    bg: 'bg-[#E6F4EC]',
    fg: 'text-[#174D2E]',
    bar: 'bg-[#206B40]',
    Icon: Stethoscope,
  },
  Health: {
    bg: 'bg-[#E8F3EB]',
    fg: 'text-[#1C4728]',
    bar: 'bg-[#255B34]',
    Icon: HeartPulse,
  },
  'Personal Care': {
    bg: 'bg-[#FAF0F5]',
    fg: 'text-[#7D2954]',
    bar: 'bg-[#A63A72]',
    Icon: Sparkles,
  },
  Fitness: {
    bg: 'bg-[#E8F5F1]',
    fg: 'text-[#165947]',
    bar: 'bg-[#1F7A61]',
    Icon: Dumbbell,
  },
  Investments: {
    bg: 'bg-[#E6F4EE]',
    fg: 'text-[#14573B]',
    bar: 'bg-[#1C7852]',
    Icon: TrendingUp,
  },
  Insurance: {
    bg: 'bg-[#EBF0F7]',
    fg: 'text-[#24436B]',
    bar: 'bg-[#335F96]',
    Icon: Shield,
  },
  Entertainment: {
    bg: 'bg-[#E8F4F4]',
    fg: 'text-[#165459]',
    bar: 'bg-[#1D7077]',
    Icon: Film,
  },
  Family: {
    bg: 'bg-[#FDF1E4]',
    fg: 'text-[#854614]',
    bar: 'bg-[#B86321]',
    Icon: Users,
  },
  Gifts: {
    bg: 'bg-[#FCECE9]',
    fg: 'text-[#8F2839]',
    bar: 'bg-[#BA384E]',
    Icon: Gift,
  },
  Charity: {
    bg: 'bg-[#FCEEF3]',
    fg: 'text-[#8A264B]',
    bar: 'bg-[#B33564]',
    Icon: HeartHandshake,
  },
  Pets: {
    bg: 'bg-[#F5EFE6]',
    fg: 'text-[#5C4428]',
    bar: 'bg-[#826038]',
    Icon: PawPrint,
  },
  Other: {
    bg: 'bg-[#EFECE6]',
    fg: 'text-[#4A433B]',
    bar: 'bg-[#6E655B]',
    Icon: Wallet,
  },
};

export function getCategoryBarClass(category: string): string {
  const meta = CATEGORY_META[category as Category];
  return meta ? meta.bar : CATEGORY_META.Other.bar;
}

interface CategoryIconProps {
  category?: string;
  isIncome?: boolean;
  label?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  isIncome = false,
  label,
}) => {
  if (isIncome) {
    const letter = (label || 'I').trim().charAt(0).toUpperCase() || 'I';
    return (
      <span
        aria-hidden="true"
        className="w-10 h-10 rounded-full bg-[#E8F3EB] text-[#1C4728] font-display font-semibold text-sm flex items-center justify-center shrink-0"
      >
        {letter}
      </span>
    );
  }

  const meta = CATEGORY_META[category as Category];
  if (meta) {
    const { bg, fg, Icon } = meta;
    return (
      <span
        aria-hidden="true"
        className={`w-10 h-10 rounded-full ${bg} ${fg} flex items-center justify-center shrink-0`}
      >
        <Icon className="w-[18px] h-[18px]" aria-hidden={true} />
      </span>
    );
  }

  const fallbackLetter = (category || 'O').trim().charAt(0).toUpperCase() || 'O';
  return (
    <span
      aria-hidden="true"
      className="w-10 h-10 rounded-full bg-[#EFECE6] text-[#4A433B] font-display font-semibold text-sm flex items-center justify-center shrink-0"
    >
      {fallbackLetter}
    </span>
  );
};

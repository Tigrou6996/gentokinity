
export interface Service {
  id: string;
  title: string;
  description: string;
  icon: string;
  features: string[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  description: string;
  icon: string;
}

export interface Stat {
  label: string;
  value: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  content: string;
  initial: string;
}

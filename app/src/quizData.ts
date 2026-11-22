import { Atom, Calculator, Dna, FlaskConical, Globe2, Landmark, type LucideIcon } from 'lucide-react';

export type Level = 'easy' | 'medium' | 'hard';

export interface Question {
  q: string;
  options: string[];
  /** Index into `options`. */
  answer: number;
}

export interface Subject {
  id: string;
  name: string;
  tagline: string;
  icon: LucideIcon;
  from: string;
  to: string;
  soft: string;
}

export const SUBJECTS: Subject[] = [
  { id: 'physics', name: 'Physics', tagline: 'Forces, motion & energy', icon: Atom, from: '#2563eb', to: '#0b3a8f', soft: '#e8f0ff' },
  { id: 'chemistry', name: 'Chemistry', tagline: 'Atoms, reactions & acids', icon: FlaskConical, from: '#0d9488', to: '#065f56', soft: '#e2f8f4' },
  { id: 'maths', name: 'Mathematics', tagline: 'Numbers & problem solving', icon: Calculator, from: '#d97706', to: '#92400e', soft: '#fff3df' },
  { id: 'history', name: 'History', tagline: 'India & the wider world', icon: Landmark, from: '#b45309', to: '#6b2f06', soft: '#fdf0e2' },
  { id: 'geography', name: 'Geography', tagline: 'Earth, places & climate', icon: Globe2, from: '#16a34a', to: '#0f6b2f', soft: '#e7f7ec' },
  { id: 'biology', name: 'Biology', tagline: 'Life, cells & the body', icon: Dna, from: '#db2777', to: '#8d1150', soft: '#fdeaf3' },
];

export const LEVELS: { id: Level; label: string; blurb: string; points: number; from: string; to: string }[] = [
  { id: 'easy', label: 'Easy', blurb: 'Warm-up questions for everyone', points: 10, from: '#22c55e', to: '#15803d' },
  { id: 'medium', label: 'Medium', blurb: 'A step up - think before you pick', points: 15, from: '#f59e0b', to: '#b45309' },
  { id: 'hard', label: 'Hard', blurb: 'For the serious quizzers', points: 20, from: '#ef4444', to: '#991b1b' },
];

export const QUESTIONS_PER_LEVEL = 5;

type Bank = Record<string, Record<Level, Question[]>>;

export const BANK: Bank = {
  physics: {
    easy: [
      { q: 'What is the SI unit of force?', options: ['Newton', 'Joule', 'Watt', 'Pascal'], answer: 0 },
      { q: 'Approximately how fast does light travel in a vacuum?', options: ['3 x 10^8 m/s', '3 x 10^5 m/s', '3 x 10^6 m/s', '3 x 10^10 m/s'], answer: 0 },
      { q: 'In a vacuum, which falls faster: a coin or a feather?', options: ['Coin', 'Feather', 'Both fall at the same rate', 'Neither falls'], answer: 2 },
      { q: 'Energy stored in a stretched rubber band is called?', options: ['Kinetic energy', 'Elastic potential energy', 'Thermal energy', 'Chemical energy'], answer: 1 },
      { q: 'Which instrument measures electric current?', options: ['Voltmeter', 'Ammeter', 'Barometer', 'Thermometer'], answer: 1 },
    ],
    medium: [
      { q: 'What is the SI unit of power?', options: ['Newton', 'Watt', 'Pascal', 'Coulomb'], answer: 1 },
      { q: 'A body stays at rest unless a force acts on it. Which law is this?', options: ['Newton\'s first law', 'Newton\'s second law', 'Newton\'s third law', 'Ohm\'s law'], answer: 0 },
      { q: 'Which of these is a scalar quantity?', options: ['Velocity', 'Acceleration', 'Force', 'Speed'], answer: 3 },
      { q: 'Work done is zero when the force is:', options: ['Parallel to displacement', 'Perpendicular to displacement', 'Opposite to displacement', 'Very large'], answer: 1 },
      { q: 'Our solar system lies in which galaxy?', options: ['Andromeda', 'Milky Way', 'Whirlpool', 'Triangulum'], answer: 1 },
    ],
    hard: [
      { q: 'The escape velocity from Earth is about:', options: ['7.9 km/s', '11.2 km/s', '16.6 km/s', '5.0 km/s'], answer: 1 },
      { q: 'Planck\'s constant has the dimension:', options: ['[MLT^-1]', '[ML^2T^-1]', '[ML^2T^-2]', '[ML^-1T^-1]'], answer: 1 },
      { q: 'The SI unit of magnetic flux is:', options: ['Tesla', 'Weber', 'Henry', 'Gauss'], answer: 1 },
      { q: 'The photoelectric effect proves the:', options: ['Wave nature of light', 'Particle nature of light', 'Both wave and particle nature equally', 'Constant speed of light'], answer: 1 },
      { q: 'Two 4-ohm resistors in parallel give a total resistance of:', options: ['8 ohm', '4 ohm', '2 ohm', '1 ohm'], answer: 2 },
    ],
  },
  chemistry: {
    easy: [
      { q: 'What is the chemical symbol for gold?', options: ['Ag', 'Au', 'Gd', 'Go'], answer: 1 },
      { q: 'The pH of pure water at 25 degrees C is:', options: ['0', '7', '10', '14'], answer: 1 },
      { q: 'Which gas do we breathe in to stay alive?', options: ['Nitrogen', 'Carbon dioxide', 'Oxygen', 'Hydrogen'], answer: 2 },
      { q: 'H2O is the chemical formula of:', options: ['Salt', 'Sugar', 'Water', 'Bleach'], answer: 2 },
      { q: 'What is the chemical formula of common table salt?', options: ['NaCl', 'KCl', 'CaCO3', 'NaOH'], answer: 0 },
    ],
    medium: [
      { q: 'What is the atomic number of carbon?', options: ['4', '6', '8', '12'], answer: 1 },
      { q: 'Which gas is usually produced when a metal reacts with a dilute acid?', options: ['Oxygen', 'Hydrogen', 'Chlorine', 'Nitrogen'], answer: 1 },
      { q: 'What is the smallest building block of an element?', options: ['Molecule', 'Atom', 'Cell', 'Mixture'], answer: 1 },
      { q: 'Rusting of iron is an example of:', options: ['Physical change', 'Oxidation', 'Reduction', 'Neutralisation'], answer: 1 },
      { q: 'What is the chemical formula of baking soda?', options: ['NaHCO3', 'Na2CO3', 'NaOH', 'CaCO3'], answer: 0 },
    ],
    hard: [
      { q: 'Avogadro\'s number is approximately:', options: ['6.022 x 10^21', '6.022 x 10^23', '6.022 x 10^25', '3.14 x 10^23'], answer: 1 },
      { q: 'Which of these is a noble gas?', options: ['Nitrogen', 'Argon', 'Bromine', 'Sulphur'], answer: 1 },
      { q: 'Oxidation involves the:', options: ['Gain of electrons', 'Loss of electrons', 'Gain of neutrons', 'Loss of protons'], answer: 1 },
      { q: 'The IUPAC name of CH3COOH is:', options: ['Ethanol', 'Ethanoic acid', 'Methanoic acid', 'Ethyl ethanoate'], answer: 1 },
      { q: 'A catalyst is a substance that:', options: ['Is used up in a reaction', 'Changes the rate of a reaction without being consumed', 'Always slows a reaction down', 'Changes the products formed'], answer: 1 },
    ],
  },
  maths: {
    easy: [
      { q: 'What is 7 x 8?', options: ['48', '54', '56', '64'], answer: 2 },
      { q: 'The perimeter of a square with side 5 cm is:', options: ['10 cm', '20 cm', '25 cm', '30 cm'], answer: 1 },
      { q: 'The smallest prime number is:', options: ['0', '1', '2', '3'], answer: 2 },
      { q: 'Half of 90 is:', options: ['35', '40', '45', '55'], answer: 2 },
      { q: 'The angle on a straight line is:', options: ['90 degrees', '180 degrees', '270 degrees', '360 degrees'], answer: 1 },
    ],
    medium: [
      { q: 'Solve 2x + 3 = 11.', options: ['x = 3', 'x = 4', 'x = 5', 'x = 7'], answer: 1 },
      { q: 'Area of a circle with radius 7 cm (pi = 22/7) is:', options: ['44 cm^2', '154 cm^2', '49 cm^2', '88 cm^2'], answer: 1 },
      { q: 'The LCM of 4 and 6 is:', options: ['8', '10', '12', '24'], answer: 2 },
      { q: 'The sum of interior angles of a triangle is:', options: ['90 degrees', '180 degrees', '270 degrees', '360 degrees'], answer: 1 },
      { q: '15% of 200 is:', options: ['15', '20', '30', '40'], answer: 2 },
    ],
    hard: [
      { q: 'The derivative of sin x with respect to x is:', options: ['cos x', '-cos x', 'tan x', 'sec x'], answer: 0 },
      { q: 'The roots of x^2 - 5x + 6 = 0 are:', options: ['1 and 6', '2 and 3', '-2 and -3', '5 and 6'], answer: 1 },
      { q: 'The value of log base 2 of 32 is:', options: ['4', '5', '6', '16'], answer: 1 },
      { q: 'The integral of x dx is:', options: ['x + C', 'x^2 + C', 'x^2 / 2 + C', '2x + C'], answer: 2 },
      { q: 'Two fair coins are tossed. Probability of two heads is:', options: ['1/2', '1/3', '1/4', '3/4'], answer: 2 },
    ],
  },
  history: {
    easy: [
      { q: 'Who was the first Prime Minister of India?', options: ['Sardar Patel', 'Jawaharlal Nehru', 'Rajendra Prasad', 'Lal Bahadur Shastri'], answer: 1 },
      { q: 'The Taj Mahal was built by which Mughal emperor?', options: ['Akbar', 'Humayun', 'Shah Jahan', 'Aurangzeb'], answer: 2 },
      { q: 'India gained independence in which year?', options: ['1942', '1945', '1947', '1950'], answer: 2 },
      { q: 'Who is called the Father of the Nation in India?', options: ['Mahatma Gandhi', 'Bhagat Singh', 'Subhas Chandra Bose', 'Bal Gangadhar Tilak'], answer: 0 },
      { q: 'Which ancient civilisation built the pyramids of Giza?', options: ['Roman', 'Greek', 'Egyptian', 'Mesopotamian'], answer: 2 },
    ],
    medium: [
      { q: 'Who founded the Maurya Empire?', options: ['Ashoka', 'Chandragupta Maurya', 'Bindusara', 'Harshavardhana'], answer: 1 },
      { q: 'The Battle of Plassey was fought in:', options: ['1707', '1757', '1764', '1857'], answer: 1 },
      { q: 'The Arthashastra was written by:', options: ['Chanakya', 'Kalidasa', 'Panini', 'Aryabhata'], answer: 0 },
      { q: 'Who built Fatehpur Sikri?', options: ['Babur', 'Humayun', 'Akbar', 'Jahangir'], answer: 2 },
      { q: 'The Quit India Movement was launched in:', options: ['1930', '1935', '1942', '1946'], answer: 2 },
    ],
    hard: [
      { q: 'Most of Ashoka\'s inscriptions were written in which script?', options: ['Devanagari', 'Brahmi', 'Kharosthi', 'Tamil'], answer: 1 },
      { q: 'The First World War began in:', options: ['1912', '1914', '1918', '1939'], answer: 1 },
      { q: 'Who was the last Mughal emperor?', options: ['Aurangzeb', 'Shah Alam II', 'Bahadur Shah Zafar', 'Akbar II'], answer: 2 },
      { q: 'Which treaty ended the First Anglo-Maratha War?', options: ['Treaty of Salbai', 'Treaty of Bassein', 'Treaty of Lahore', 'Treaty of Srirangapatna'], answer: 0 },
      { q: 'The Indian National Congress was founded in:', options: ['1875', '1885', '1905', '1919'], answer: 1 },
    ],
  },
  geography: {
    easy: [
      { q: 'Which is the largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], answer: 3 },
      { q: 'What is the capital of India?', options: ['Mumbai', 'Kolkata', 'New Delhi', 'Chennai'], answer: 2 },
      { q: 'Which is the longest river in India?', options: ['Yamuna', 'Ganga', 'Godavari', 'Narmada'], answer: 1 },
      { q: 'Which is the largest continent?', options: ['Africa', 'Asia', 'Europe', 'North America'], answer: 1 },
      { q: 'The Sahara Desert is located in which continent?', options: ['Asia', 'Africa', 'Australia', 'South America'], answer: 1 },
    ],
    medium: [
      { q: 'Which line divides Earth into the Northern and Southern hemispheres?', options: ['Prime Meridian', 'Equator', 'Tropic of Cancer', 'International Date Line'], answer: 1 },
      { q: 'The highest mountain peak in the world is:', options: ['K2', 'Kanchenjunga', 'Mount Everest', 'Mount Kilimanjaro'], answer: 2 },
      { q: 'Which Indian state has the longest coastline?', options: ['Tamil Nadu', 'Gujarat', 'Odisha', 'Kerala'], answer: 1 },
      { q: 'The Thar Desert is mainly located in:', options: ['Rajasthan', 'Punjab', 'Gujarat', 'Haryana'], answer: 0 },
      { q: 'Which planet is closest to the Sun?', options: ['Venus', 'Mercury', 'Mars', 'Earth'], answer: 1 },
    ],
    hard: [
      { q: 'The Tropic of Cancer passes through how many Indian states?', options: ['6', '7', '8', '9'], answer: 2 },
      { q: 'The deepest ocean trench on Earth is the:', options: ['Java Trench', 'Puerto Rico Trench', 'Mariana Trench', 'Tonga Trench'], answer: 2 },
      { q: 'Mount Kilimanjaro is located in:', options: ['Kenya', 'Tanzania', 'Uganda', 'Ethiopia'], answer: 1 },
      { q: 'Which river is known as the "Sorrow of Bihar"?', options: ['Gandak', 'Kosi', 'Son', 'Damodar'], answer: 1 },
      { q: 'The Strait of Malacca lies between the Malay Peninsula and:', options: ['Sumatra', 'Borneo', 'Java', 'Sri Lanka'], answer: 0 },
    ],
  },
  biology: {
    easy: [
      { q: 'Which is the largest organ of the human body?', options: ['Liver', 'Skin', 'Brain', 'Lungs'], answer: 1 },
      { q: 'Which gas do plants take in for photosynthesis?', options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'], answer: 1 },
      { q: 'Which organ pumps blood around the body?', options: ['Liver', 'Brain', 'Heart', 'Kidney'], answer: 2 },
      { q: 'Which part of a plant absorbs water from the soil?', options: ['Leaf', 'Root', 'Flower', 'Stem'], answer: 1 },
      { q: 'The young one of a frog is called a:', options: ['Chick', 'Tadpole', 'Caterpillar', 'Calf'], answer: 1 },
    ],
    medium: [
      { q: 'What is the basic structural and functional unit of life?', options: ['Tissue', 'Organ', 'Cell', 'Molecule'], answer: 2 },
      { q: 'How many pairs of chromosomes does a normal human body cell have?', options: ['21', '22', '23', '24'], answer: 2 },
      { q: 'Which vitamin does our skin produce in sunlight?', options: ['Vitamin A', 'Vitamin B12', 'Vitamin C', 'Vitamin D'], answer: 3 },
      { q: 'Red blood cells mainly carry:', options: ['Oxygen', 'Hormones', 'Antibodies', 'Fat'], answer: 0 },
      { q: 'Which cell organelle is called the powerhouse of the cell?', options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi body'], answer: 2 },
    ],
    hard: [
      { q: 'Which blood group is known as the universal donor?', options: ['AB positive', 'O negative', 'A positive', 'B negative'], answer: 1 },
      { q: 'The loss of water vapour from plant leaves is called:', options: ['Respiration', 'Transpiration', 'Photosynthesis', 'Digestion'], answer: 1 },
      { q: 'Which is the largest gland in the human body?', options: ['Pancreas', 'Thyroid', 'Liver', 'Salivary gland'], answer: 2 },
      { q: 'DNA stands for:', options: ['Dinucleic acid', 'Deoxyribonucleic acid', 'Deoxyribose nucleotide', 'Double nucleic acid'], answer: 1 },
      { q: 'Which enzyme in saliva starts the digestion of starch?', options: ['Pepsin', 'Trypsin', 'Amylase', 'Lipase'], answer: 2 },
    ],
  },
};

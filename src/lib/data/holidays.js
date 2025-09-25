/**
 * New Zealand Holiday Data for 2025-2026
 * Comprehensive collection of public holidays, seasonal events, school holidays, and marketing-relevant international holidays
 */

const holidays = {
  // 2025 HOLIDAYS
  '2025-01-01': {
    name: 'New Year\'s Day',
    type: 'public_holiday',
    category: 'New Year',
    marketingAngle: 'Fresh starts, goal setting, new year resolutions, brand new beginnings'
  },
  '2025-01-02': {
    name: 'Day after New Year\'s Day',
    type: 'public_holiday',
    category: 'New Year',
    marketingAngle: 'Recovery day, extended celebrations, family time, relaxation content'
  },
  '2025-01-20': {
    name: 'Wellington Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Wellington pride, local business support, regional identity, capital city celebrations'
  },
  '2025-01-22': {
    name: 'Auckland Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Auckland pride, city of sails, local business support, regional identity'
  },
  '2025-01-27': {
    name: 'Nelson Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Nelson pride, arts and culture, local business support, regional identity'
  },
  '2025-02-06': {
    name: 'Waitangi Day',
    type: 'public_holiday',
    category: 'National',
    marketingAngle: 'New Zealand identity, cultural celebration, national pride, Māori culture, unity'
  },
  '2025-02-14': {
    name: 'Valentine\'s Day',
    type: 'international',
    category: 'Romance',
    marketingAngle: 'Love, romance, relationships, gifts, dining out, flowers, couples content'
  },
  '2025-02-17': {
    name: 'Taranaki Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Taranaki pride, mountain region, local business support, regional identity'
  },
  '2025-03-03': {
    name: 'Otago Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Otago pride, university town, local business support, regional identity'
  },
  '2025-03-10': {
    name: 'Tasman Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Tasman pride, local business support, regional identity'
  },
  '2025-03-14': {
    name: 'Southland Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Southland pride, local business support, regional identity'
  },
  '2025-03-17': {
    name: 'St. Patrick\'s Day',
    type: 'international',
    category: 'Cultural',
    marketingAngle: 'Irish culture, green themes, celebrations, pub culture, community events'
  },
  '2025-03-21': {
    name: 'Good Friday',
    type: 'public_holiday',
    category: 'Religious',
    marketingAngle: 'Easter preparation, family time, reflection, traditional foods, religious observance'
  },
  '2025-03-24': {
    name: 'Easter Monday',
    type: 'public_holiday',
    category: 'Religious',
    marketingAngle: 'Easter celebrations, family gatherings, chocolate, spring themes, renewal'
  },
  '2025-03-25': {
    name: 'ANZAC Day',
    type: 'public_holiday',
    category: 'National',
    marketingAngle: 'Remembrance, national pride, military history, dawn services, community respect'
  },
  '2025-04-01': {
    name: 'April Fools\' Day',
    type: 'international',
    category: 'Fun',
    marketingAngle: 'Humor, pranks, light-hearted content, brand personality, engagement'
  },
  '2025-04-21': {
    name: 'Hawke\'s Bay Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Hawke\'s Bay pride, wine region, local business support, regional identity'
  },
  '2025-04-22': {
    name: 'Earth Day',
    type: 'international',
    category: 'Environmental',
    marketingAngle: 'Sustainability, environmental awareness, eco-friendly products, green initiatives'
  },
  '2025-04-25': {
    name: 'ANZAC Day',
    type: 'public_holiday',
    category: 'National',
    marketingAngle: 'Remembrance, national pride, military history, dawn services, community respect'
  },
  '2025-05-05': {
    name: 'Westland Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Westland pride, local business support, regional identity'
  },
  '2025-05-12': {
    name: 'Marlborough Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Marlborough pride, wine region, local business support, regional identity'
  },
  '2025-05-26': {
    name: 'Queen\'s Birthday',
    type: 'public_holiday',
    category: 'National',
    marketingAngle: 'Monarchy, national celebration, long weekend, winter activities, family time'
  },
  '2025-06-02': {
    name: 'Matariki',
    type: 'public_holiday',
    category: 'Cultural',
    marketingAngle: 'Māori New Year, cultural celebration, winter solstice, family gatherings, traditional foods'
  },
  '2025-06-15': {
    name: 'Father\'s Day',
    type: 'international',
    category: 'Family',
    marketingAngle: 'Fatherhood, family appreciation, gifts, family time, male role models'
  },
  '2025-07-14': {
    name: 'Bastille Day',
    type: 'international',
    category: 'Cultural',
    marketingAngle: 'French culture, international celebration, cultural diversity'
  },
  '2025-08-04': {
    name: 'South Canterbury Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'South Canterbury pride, local business support, regional identity'
  },
  '2025-08-11': {
    name: 'Canterbury Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Canterbury pride, local business support, regional identity'
  },
  '2025-08-18': {
    name: 'Hawke\'s Bay Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Hawke\'s Bay pride, wine region, local business support, regional identity'
  },
  '2025-08-25': {
    name: 'Marlborough Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Marlborough pride, wine region, local business support, regional identity'
  },
  '2025-09-01': {
    name: 'Southland Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Southland pride, local business support, regional identity'
  },
  '2025-09-08': {
    name: 'Taranaki Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Taranaki pride, mountain region, local business support, regional identity'
  },
  '2025-09-15': {
    name: 'Tasman Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Tasman pride, local business support, regional identity'
  },
  '2025-09-22': {
    name: 'Otago Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Otago pride, university town, local business support, regional identity'
  },
  '2025-09-29': {
    name: 'Westland Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Westland pride, local business support, regional identity'
  },
  '2025-10-06': {
    name: 'Hawke\'s Bay Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Hawke\'s Bay pride, wine region, local business support, regional identity'
  },
  '2025-10-13': {
    name: 'Marlborough Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Marlborough pride, wine region, local business support, regional identity'
  },
  '2025-10-20': {
    name: 'South Canterbury Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'South Canterbury pride, local business support, regional identity'
  },
  '2025-10-27': {
    name: 'Canterbury Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Canterbury pride, local business support, regional identity'
  },
  '2025-10-31': {
    name: 'Halloween',
    type: 'international',
    category: 'Fun',
    marketingAngle: 'Costumes, decorations, trick-or-treating, spooky themes, parties, candy'
  },
  '2025-11-03': {
    name: 'Hawke\'s Bay Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Hawke\'s Bay pride, wine region, local business support, regional identity'
  },
  '2025-11-10': {
    name: 'Marlborough Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Marlborough pride, wine region, local business support, regional identity'
  },
  '2025-11-17': {
    name: 'Southland Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Southland pride, local business support, regional identity'
  },
  '2025-11-24': {
    name: 'Taranaki Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Taranaki pride, mountain region, local business support, regional identity'
  },
  '2025-11-28': {
    name: 'Black Friday',
    type: 'international',
    category: 'Shopping',
    marketingAngle: 'Sales, discounts, shopping deals, retail promotions, holiday shopping kickoff'
  },
  '2025-12-01': {
    name: 'Tasman Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Tasman pride, local business support, regional identity'
  },
  '2025-12-08': {
    name: 'Otago Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Otago pride, university town, local business support, regional identity'
  },
  '2025-12-15': {
    name: 'Westland Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Westland pride, local business support, regional identity'
  },
  '2025-12-22': {
    name: 'Hawke\'s Bay Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Hawke\'s Bay pride, wine region, local business support, regional identity'
  },
  '2025-12-25': {
    name: 'Christmas Day',
    type: 'public_holiday',
    category: 'Religious',
    marketingAngle: 'Christmas celebrations, family gatherings, gifts, festive decorations, holiday spirit'
  },
  '2025-12-26': {
    name: 'Boxing Day',
    type: 'public_holiday',
    category: 'Religious',
    marketingAngle: 'Post-Christmas sales, family time, leftovers, relaxation, shopping deals'
  },

  // 2026 HOLIDAYS
  '2026-01-01': {
    name: 'New Year\'s Day',
    type: 'public_holiday',
    category: 'New Year',
    marketingAngle: 'Fresh starts, goal setting, new year resolutions, brand new beginnings'
  },
  '2026-01-02': {
    name: 'Day after New Year\'s Day',
    type: 'public_holiday',
    category: 'New Year',
    marketingAngle: 'Recovery day, extended celebrations, family time, relaxation content'
  },
  '2026-01-19': {
    name: 'Wellington Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Wellington pride, local business support, regional identity, capital city celebrations'
  },
  '2026-01-26': {
    name: 'Auckland Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Auckland pride, city of sails, local business support, regional identity'
  },
  '2026-01-27': {
    name: 'Nelson Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Nelson pride, arts and culture, local business support, regional identity'
  },
  '2026-02-06': {
    name: 'Waitangi Day',
    type: 'public_holiday',
    category: 'National',
    marketingAngle: 'New Zealand identity, cultural celebration, national pride, Māori culture, unity'
  },
  '2026-02-14': {
    name: 'Valentine\'s Day',
    type: 'international',
    category: 'Romance',
    marketingAngle: 'Love, romance, relationships, gifts, dining out, flowers, couples content'
  },
  '2026-02-16': {
    name: 'Taranaki Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Taranaki pride, mountain region, local business support, regional identity'
  },
  '2026-03-02': {
    name: 'Otago Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Otago pride, university town, local business support, regional identity'
  },
  '2026-03-09': {
    name: 'Tasman Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Tasman pride, local business support, regional identity'
  },
  '2026-03-16': {
    name: 'Southland Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Southland pride, local business support, regional identity'
  },
  '2026-03-17': {
    name: 'St. Patrick\'s Day',
    type: 'international',
    category: 'Cultural',
    marketingAngle: 'Irish culture, green themes, celebrations, pub culture, community events'
  },
  '2026-03-29': {
    name: 'Good Friday',
    type: 'public_holiday',
    category: 'Religious',
    marketingAngle: 'Easter preparation, family time, reflection, traditional foods, religious observance'
  },
  '2026-04-01': {
    name: 'Easter Monday',
    type: 'public_holiday',
    category: 'Religious',
    marketingAngle: 'Easter celebrations, family gatherings, chocolate, spring themes, renewal'
  },
  '2026-04-01': {
    name: 'April Fools\' Day',
    type: 'international',
    category: 'Fun',
    marketingAngle: 'Humor, pranks, light-hearted content, brand personality, engagement'
  },
  '2026-04-25': {
    name: 'ANZAC Day',
    type: 'public_holiday',
    category: 'National',
    marketingAngle: 'Remembrance, national pride, military history, dawn services, community respect'
  },
  '2026-04-22': {
    name: 'Earth Day',
    type: 'international',
    category: 'Environmental',
    marketingAngle: 'Sustainability, environmental awareness, eco-friendly products, green initiatives'
  },
  '2026-05-04': {
    name: 'Westland Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Westland pride, local business support, regional identity'
  },
  '2026-05-11': {
    name: 'Marlborough Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Marlborough pride, wine region, local business support, regional identity'
  },
  '2026-05-25': {
    name: 'Queen\'s Birthday',
    type: 'public_holiday',
    category: 'National',
    marketingAngle: 'Monarchy, national celebration, long weekend, winter activities, family time'
  },
  '2026-06-21': {
    name: 'Matariki',
    type: 'public_holiday',
    category: 'Cultural',
    marketingAngle: 'Māori New Year, cultural celebration, winter solstice, family gatherings, traditional foods'
  },
  '2026-06-21': {
    name: 'Father\'s Day',
    type: 'international',
    category: 'Family',
    marketingAngle: 'Fatherhood, family appreciation, gifts, family time, male role models'
  },
  '2026-07-14': {
    name: 'Bastille Day',
    type: 'international',
    category: 'Cultural',
    marketingAngle: 'French culture, international celebration, cultural diversity'
  },
  '2026-08-03': {
    name: 'South Canterbury Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'South Canterbury pride, local business support, regional identity'
  },
  '2026-08-10': {
    name: 'Canterbury Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Canterbury pride, local business support, regional identity'
  },
  '2026-08-17': {
    name: 'Hawke\'s Bay Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Hawke\'s Bay pride, wine region, local business support, regional identity'
  },
  '2026-08-24': {
    name: 'Marlborough Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Marlborough pride, wine region, local business support, regional identity'
  },
  '2026-08-31': {
    name: 'Southland Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Southland pride, local business support, regional identity'
  },
  '2026-09-07': {
    name: 'Taranaki Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Taranaki pride, mountain region, local business support, regional identity'
  },
  '2026-09-14': {
    name: 'Tasman Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Tasman pride, local business support, regional identity'
  },
  '2026-09-21': {
    name: 'Otago Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Otago pride, university town, local business support, regional identity'
  },
  '2026-09-28': {
    name: 'Westland Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Westland pride, local business support, regional identity'
  },
  '2026-10-05': {
    name: 'Hawke\'s Bay Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Hawke\'s Bay pride, wine region, local business support, regional identity'
  },
  '2026-10-12': {
    name: 'Marlborough Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Marlborough pride, wine region, local business support, regional identity'
  },
  '2026-10-19': {
    name: 'South Canterbury Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'South Canterbury pride, local business support, regional identity'
  },
  '2026-10-26': {
    name: 'Canterbury Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Canterbury pride, local business support, regional identity'
  },
  '2026-10-31': {
    name: 'Halloween',
    type: 'international',
    category: 'Fun',
    marketingAngle: 'Costumes, decorations, trick-or-treating, spooky themes, parties, candy'
  },
  '2026-11-02': {
    name: 'Hawke\'s Bay Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Hawke\'s Bay pride, wine region, local business support, regional identity'
  },
  '2026-11-09': {
    name: 'Marlborough Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Marlborough pride, wine region, local business support, regional identity'
  },
  '2026-11-16': {
    name: 'Southland Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Southland pride, local business support, regional identity'
  },
  '2026-11-23': {
    name: 'Taranaki Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Taranaki pride, mountain region, local business support, regional identity'
  },
  '2026-11-27': {
    name: 'Black Friday',
    type: 'international',
    category: 'Shopping',
    marketingAngle: 'Sales, discounts, shopping deals, retail promotions, holiday shopping kickoff'
  },
  '2026-11-30': {
    name: 'Tasman Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Tasman pride, local business support, regional identity'
  },
  '2026-12-07': {
    name: 'Otago Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Otago pride, university town, local business support, regional identity'
  },
  '2026-12-14': {
    name: 'Westland Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Westland pride, local business support, regional identity'
  },
  '2026-12-21': {
    name: 'Hawke\'s Bay Anniversary Day',
    type: 'public_holiday',
    category: 'Regional',
    marketingAngle: 'Hawke\'s Bay pride, wine region, local business support, regional identity'
  },
  '2026-12-25': {
    name: 'Christmas Day',
    type: 'public_holiday',
    category: 'Religious',
    marketingAngle: 'Christmas celebrations, family gatherings, gifts, festive decorations, holiday spirit'
  },
  '2026-12-26': {
    name: 'Boxing Day',
    type: 'public_holiday',
    category: 'Religious',
    marketingAngle: 'Post-Christmas sales, family time, leftovers, relaxation, shopping deals'
  },

  // SEASONAL TRANSITIONS AND BUSINESS-RELEVANT EVENTS
  '2025-03-01': {
    name: 'Autumn Begins',
    type: 'seasonal',
    category: 'Seasonal',
    marketingAngle: 'Autumn themes, harvest season, cozy content, warm colors, seasonal products'
  },
  '2025-06-01': {
    name: 'Winter Begins',
    type: 'seasonal',
    category: 'Seasonal',
    marketingAngle: 'Winter activities, warm clothing, indoor activities, hot beverages, comfort food'
  },
  '2025-09-01': {
    name: 'Spring Begins',
    type: 'seasonal',
    category: 'Seasonal',
    marketingAngle: 'Spring renewal, fresh starts, outdoor activities, blooming themes, new growth'
  },
  '2025-12-01': {
    name: 'Summer Begins',
    type: 'seasonal',
    category: 'Seasonal',
    marketingAngle: 'Summer activities, outdoor fun, beach content, warm weather, vacation planning'
  },
  '2026-03-01': {
    name: 'Autumn Begins',
    type: 'seasonal',
    category: 'Seasonal',
    marketingAngle: 'Autumn themes, harvest season, cozy content, warm colors, seasonal products'
  },
  '2026-06-01': {
    name: 'Winter Begins',
    type: 'seasonal',
    category: 'Seasonal',
    marketingAngle: 'Winter activities, warm clothing, indoor activities, hot beverages, comfort food'
  },
  '2026-09-01': {
    name: 'Spring Begins',
    type: 'seasonal',
    category: 'Seasonal',
    marketingAngle: 'Spring renewal, fresh starts, outdoor activities, blooming themes, new growth'
  },
  '2026-12-01': {
    name: 'Summer Begins',
    type: 'seasonal',
    category: 'Seasonal',
    marketingAngle: 'Summer activities, outdoor fun, beach content, warm weather, vacation planning'
  },

  // SCHOOL HOLIDAYS (Approximate dates - varies by region)
  '2025-04-12': {
    name: 'Easter School Holidays Begin',
    type: 'business_relevant',
    category: 'Education',
    marketingAngle: 'Family activities, school holiday programs, children\'s content, family entertainment'
  },
  '2025-04-28': {
    name: 'Easter School Holidays End',
    type: 'business_relevant',
    category: 'Education',
    marketingAngle: 'Back to school, educational content, learning resources, student life'
  },
  '2025-07-05': {
    name: 'Winter School Holidays Begin',
    type: 'business_relevant',
    category: 'Education',
    marketingAngle: 'Winter activities, indoor entertainment, family time, holiday programs'
  },
  '2025-07-20': {
    name: 'Winter School Holidays End',
    type: 'business_relevant',
    category: 'Education',
    marketingAngle: 'Back to school, winter preparation, educational content, student life'
  },
  '2025-09-27': {
    name: 'Spring School Holidays Begin',
    type: 'business_relevant',
    category: 'Education',
    marketingAngle: 'Spring activities, outdoor fun, family time, seasonal content'
  },
  '2025-10-12': {
    name: 'Spring School Holidays End',
    type: 'business_relevant',
    category: 'Education',
    marketingAngle: 'Back to school, spring preparation, educational content, student life'
  },
  '2025-12-20': {
    name: 'Summer School Holidays Begin',
    type: 'business_relevant',
    category: 'Education',
    marketingAngle: 'Summer activities, vacation planning, family time, outdoor content'
  },
  '2026-01-27': {
    name: 'Summer School Holidays End',
    type: 'business_relevant',
    category: 'Education',
    marketingAngle: 'Back to school, new year preparation, educational content, student life'
  },

  // ADDITIONAL MARKETING-RELEVANT INTERNATIONAL HOLIDAYS
  '2025-03-08': {
    name: 'International Women\'s Day',
    type: 'international',
    category: 'Social',
    marketingAngle: 'Women empowerment, gender equality, female leadership, women\'s achievements'
  },
  '2025-05-12': {
    name: 'Mother\'s Day',
    type: 'international',
    category: 'Family',
    marketingAngle: 'Motherhood appreciation, family gifts, family time, maternal love'
  },
  '2025-06-21': {
    name: 'International Yoga Day',
    type: 'international',
    category: 'Wellness',
    marketingAngle: 'Health and wellness, mindfulness, fitness, mental health, self-care'
  },
  '2025-09-21': {
    name: 'International Day of Peace',
    type: 'international',
    category: 'Social',
    marketingAngle: 'Peace, unity, social harmony, community building, positive messaging'
  },
  '2025-10-05': {
    name: 'World Teachers\' Day',
    type: 'international',
    category: 'Education',
    marketingAngle: 'Education appreciation, teacher recognition, learning, knowledge sharing'
  },
  '2025-11-11': {
    name: 'Remembrance Day',
    type: 'international',
    category: 'Memorial',
    marketingAngle: 'Remembrance, respect, historical significance, community honor'
  },
  '2025-12-03': {
    name: 'International Day of Persons with Disabilities',
    type: 'international',
    category: 'Social',
    marketingAngle: 'Inclusion, accessibility, diversity, equal opportunities, social awareness'
  },
  '2026-03-08': {
    name: 'International Women\'s Day',
    type: 'international',
    category: 'Social',
    marketingAngle: 'Women empowerment, gender equality, female leadership, women\'s achievements'
  },
  '2026-05-10': {
    name: 'Mother\'s Day',
    type: 'international',
    category: 'Family',
    marketingAngle: 'Motherhood appreciation, family gifts, family time, maternal love'
  },
  '2026-06-21': {
    name: 'International Yoga Day',
    type: 'international',
    category: 'Wellness',
    marketingAngle: 'Health and wellness, mindfulness, fitness, mental health, self-care'
  },
  '2026-09-21': {
    name: 'International Day of Peace',
    type: 'international',
    category: 'Social',
    marketingAngle: 'Peace, unity, social harmony, community building, positive messaging'
  },
  '2026-10-05': {
    name: 'World Teachers\' Day',
    type: 'international',
    category: 'Education',
    marketingAngle: 'Education appreciation, teacher recognition, learning, knowledge sharing'
  },
  '2026-11-11': {
    name: 'Remembrance Day',
    type: 'international',
    category: 'Memorial',
    marketingAngle: 'Remembrance, respect, historical significance, community honor'
  },
  '2026-12-03': {
    name: 'International Day of Persons with Disabilities',
    type: 'international',
    category: 'Social',
    marketingAngle: 'Inclusion, accessibility, diversity, equal opportunities, social awareness'
  }
};

/**
 * Get upcoming holidays within the specified number of weeks
 * @param {number} weeksAhead - Number of weeks to look ahead (default: 8)
 * @returns {Array} Array of holiday objects with date information
 */
function getUpcomingHolidays(weeksAhead = 8) {
  const today = new Date();
  const futureDate = new Date(today.getTime() + (weeksAhead * 7 * 24 * 60 * 60 * 1000));
  
  const upcomingHolidays = [];
  
  for (const [dateStr, holiday] of Object.entries(holidays)) {
    const holidayDate = new Date(dateStr);
    
    if (holidayDate >= today && holidayDate <= futureDate) {
      upcomingHolidays.push({
        date: dateStr,
        ...holiday
      });
    }
  }
  
  // Sort by date
  return upcomingHolidays.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Format holidays for AI prompt integration
 * @param {Array} holidays - Array of holiday objects
 * @returns {string} Formatted string for AI prompts
 */
function formatHolidaysForPrompt(holidays) {
  if (!holidays || holidays.length === 0) {
    return 'No upcoming holidays found.';
  }
  
  const formattedHolidays = holidays.map(holiday => {
    const date = new Date(holiday.date).toLocaleDateString('en-NZ', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    return `${date}: ${holiday.name} (${holiday.type}) - ${holiday.marketingAngle}`;
  }).join('\n');
  
  return `Upcoming holidays and events:\n${formattedHolidays}`;
}

/**
 * Get holidays by type
 * @param {string} type - Type of holiday (public_holiday, international, seasonal, business_relevant)
 * @returns {Array} Array of holiday objects matching the type
 */
function getHolidaysByType(type) {
  return Object.entries(holidays)
    .filter(([_, holiday]) => holiday.type === type)
    .map(([date, holiday]) => ({ date, ...holiday }));
}

/**
 * Get holidays by category
 * @param {string} category - Category of holiday
 * @returns {Array} Array of holiday objects matching the category
 */
function getHolidaysByCategory(category) {
  return Object.entries(holidays)
    .filter(([_, holiday]) => holiday.category === category)
    .map(([date, holiday]) => ({ date, ...holiday }));
}

/**
 * Search holidays by name or marketing angle
 * @param {string} searchTerm - Term to search for
 * @returns {Array} Array of matching holiday objects
 */
function searchHolidays(searchTerm) {
  const term = searchTerm.toLowerCase();
  
  return Object.entries(holidays)
    .filter(([_, holiday]) => 
      holiday.name.toLowerCase().includes(term) ||
      holiday.marketingAngle.toLowerCase().includes(term) ||
      holiday.category.toLowerCase().includes(term)
    )
    .map(([date, holiday]) => ({ date, ...holiday }));
}

module.exports = {
  holidays,
  getUpcomingHolidays,
  formatHolidaysForPrompt,
  getHolidaysByType,
  getHolidaysByCategory,
  searchHolidays
};

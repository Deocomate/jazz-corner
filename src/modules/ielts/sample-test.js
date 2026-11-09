// Đề Reading mẫu TỰ SOẠN để luyện tập (không phải đề Cambridge/IDP/BC).
// Cùng định dạng với tính năng "Nhập đề từ JSON".
export const SAMPLE_TEST_KEY = 'reading-practice-urban-forest';

export const SAMPLE_TEST = {
  title: 'Practice Reading 1: The Return of the Urban Forest',
  description: 'A practice test written for this app (sample data) — 1 passage, 14 questions covering TFNG, Multiple Choice, Matching Headings and Completion.',
  time_limit_minutes: 20,
  passages: [
    {
      title: 'The Return of the Urban Forest',
      body: `For much of the twentieth century, trees were treated as little more than decoration in city planning. They were planted where space allowed and removed whenever roads needed widening. Today, however, a growing body of research suggests that urban trees deliver measurable benefits, and many municipalities now regard them as essential infrastructure rather than optional ornament.

The most obvious benefit is temperature control. Paved surfaces absorb heat during the day and release it at night, producing what scientists call the urban heat island effect. A study conducted across several European cities found that streets with continuous tree cover were, on average, up to four degrees cooler in summer than comparable streets without trees. Shade reduces the demand for air conditioning, which in turn lowers energy consumption.

Trees also manage water. During heavy rainfall, their canopies intercept a proportion of the rain, while their roots help soil absorb what reaches the ground. This slows the flow of water into drainage systems, which are frequently overwhelmed during storms. Engineers in one Scandinavian city calculated that expanding tree cover would be considerably cheaper than enlarging the underground pipe network.

The social effects are harder to quantify but no less significant. Residents of tree-lined neighbourhoods report lower levels of stress, and some researchers have linked greener streets to higher rates of walking and outdoor activity. Critics caution, though, that such correlations do not prove causation: wealthier districts tend to have more trees, and wealth itself is associated with better health.

Despite the evidence, planting trees in cities is far from straightforward. Young trees need regular watering for their first three years, and many die because maintenance budgets are cut once the planting ceremony is over. Underground cables and pipes restrict where roots can grow. As a result, experts increasingly argue that the success of an urban forest depends less on the number of trees planted than on the long-term commitment to caring for them.`,
    },
  ],
  groups: [
    {
      passage: 1,
      type: 'tfng',
      instructions: 'Do the following statements agree with the information given in the passage? Write TRUE, FALSE or NOT GIVEN.',
      questions: [
        {
          number: 1, prompt: 'In the twentieth century, city planners generally considered trees to be essential infrastructure.', answer: 'FALSE',
          evidence: 'For much of the twentieth century, trees were treated as little more than decoration in city planning.',
          explanation: 'The passage says trees were seen as mere "decoration"; "essential infrastructure" is today’s view, so the statement contradicts the passage = FALSE.',
        },
        {
          number: 2, prompt: 'Streets with continuous tree cover can be several degrees cooler in summer.', answer: 'TRUE',
          evidence: 'streets with continuous tree cover were, on average, up to four degrees cooler in summer',
          explanation: '"several degrees" paraphrases "up to four degrees" → TRUE.',
        },
        {
          number: 3, prompt: 'Most European cities have now banned the removal of mature trees.', answer: 'NOT GIVEN',
          evidence: '',
          explanation: 'The passage never mentions a ban on removing trees. Careful: it does talk about European cities, but not this idea → NOT GIVEN.',
        },
        {
          number: 4, prompt: 'Researchers agree that trees are the direct cause of better health in green neighbourhoods.', answer: 'FALSE',
          evidence: 'Critics caution, though, that such correlations do not prove causation',
          explanation: 'The passage says correlation does not prove causation and critics disagree, so "agree… direct cause" contradicts it = FALSE.',
        },
      ],
    },
    {
      passage: 1,
      type: 'mcq',
      instructions: 'Choose the correct letter, A, B, C or D.',
      questions: [
        {
          number: 5, prompt: 'According to the passage, shade from trees leads to', answer: 'C',
          options: [
            { key: 'A', text: 'higher property prices.' },
            { key: 'B', text: 'warmer nights in summer.' },
            { key: 'C', text: 'reduced energy use.' },
            { key: 'D', text: 'fewer paved surfaces.' },
          ],
          evidence: 'Shade reduces the demand for air conditioning, which in turn lowers energy consumption.',
          explanation: '"reduced energy use" = "lowers energy consumption". B is a trap: warm nights come from paved surfaces releasing heat, not from shade.',
        },
        {
          number: 6, prompt: 'What did engineers in a Scandinavian city conclude?', answer: 'B',
          options: [
            { key: 'A', text: 'Drainage pipes should be replaced every few years.' },
            { key: 'B', text: 'More trees would cost less than bigger pipes.' },
            { key: 'C', text: 'Tree roots damage underground pipes.' },
            { key: 'D', text: 'Storms are becoming more frequent.' },
          ],
          evidence: 'expanding tree cover would be considerably cheaper than enlarging the underground pipe network',
          explanation: '"cost less than bigger pipes" paraphrases "considerably cheaper than enlarging the underground pipe network".',
        },
        {
          number: 7, prompt: 'Why do many newly planted city trees die?', answer: 'D',
          options: [
            { key: 'A', text: 'They are planted in the wrong season.' },
            { key: 'B', text: 'Their roots are damaged by heavy rain.' },
            { key: 'C', text: 'Residents remove them for parking space.' },
            { key: 'D', text: 'Funding for their care is reduced after planting.' },
          ],
          evidence: 'many die because maintenance budgets are cut once the planting ceremony is over',
          explanation: '"Funding for their care is reduced" = "maintenance budgets are cut".',
        },
      ],
    },
    {
      passage: 1,
      type: 'headings',
      instructions: 'The passage has five paragraphs, A–E. Choose the correct heading for paragraphs B–E from the list of headings below.',
      options: [
        { key: 'i', text: 'A benefit that is difficult to measure' },
        { key: 'ii', text: 'Keeping cities cooler' },
        { key: 'iii', text: 'The history of city parks' },
        { key: 'iv', text: 'Why planting alone is not enough' },
        { key: 'v', text: 'A natural solution to flooding' },
        { key: 'vi', text: 'The rising cost of air conditioning' },
      ],
      questions: [
        { number: 8, prompt: 'Paragraph B', answer: 'ii', evidence: 'The most obvious benefit is temperature control.', explanation: 'The whole paragraph is about the heat island effect and cooling. Heading vi is only a minor detail.' },
        { number: 9, prompt: 'Paragraph C', answer: 'v', evidence: 'Trees also manage water.', explanation: 'The paragraph explains how trees absorb rainwater and take pressure off drains during storms.' },
        { number: 10, prompt: 'Paragraph D', answer: 'i', evidence: 'The social effects are harder to quantify but no less significant.', explanation: '"difficult to measure" = "harder to quantify".' },
        { number: 11, prompt: 'Paragraph E', answer: 'iv', evidence: 'the success of an urban forest depends less on the number of trees planted than on the long-term commitment to caring for them', explanation: 'Main idea: planting is not enough — long-term care is what matters.' },
      ],
    },
    {
      passage: 1,
      type: 'completion',
      word_limit: 2,
      instructions: 'Complete the sentences below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
      questions: [
        { number: 12, prompt: 'Paved surfaces contribute to a phenomenon known as the urban ________.', answer: 'heat island', accepted: ['heat-island'], evidence: 'producing what scientists call the urban heat island effect', explanation: 'A fixed noun phrase. Writing "heat island effect" (3 words) is marked wrong because it exceeds the 2-word limit; the hyphenated variant "heat-island" is declared as accepted by the test author.' },
        { number: 13, prompt: 'During storms, ________ are often unable to cope with the volume of water.', answer: 'drainage systems', evidence: 'drainage systems, which are frequently overwhelmed during storms', explanation: '"unable to cope" = "overwhelmed".' },
        { number: 14, prompt: 'Young trees require regular ________ for their first three years.', answer: 'watering', evidence: 'Young trees need regular watering for their first three years', explanation: 'The gerund "watering" follows the adjective "regular".' },
      ],
    },
  ],
};

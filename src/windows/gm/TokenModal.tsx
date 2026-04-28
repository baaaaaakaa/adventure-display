import { useState } from 'react'
import { StyledSelect } from '../../components/StyledSelect'
import {
  tokenSpaceLabels,
  tokenSpaceValues,
  type AdventureScene,
  type MonsterBlock,
  type MonsterFeature,
  type PlayerCharacter,
  type TokenInstance,
  type TokenKind,
  type TokenSpace,
} from '../../types/adventure'
import styles from './TokenModal.module.css'

type TokenModalProps = {
  activeScene: AdventureScene | null
  characters: PlayerCharacter[]
  linkedCharacter: PlayerCharacter | null
  linkedMonster: MonsterBlock | null
  token: TokenInstance
  onClose: () => void
  onFocusLinkedCharacter: (characterId: string) => void
  onFocusLinkedMonster: (token: TokenInstance) => void
  onRemoveToken: (tokenId: string) => void
  onReplaceTokenImage: (tokenId: string, file: File | null) => void | Promise<void>
  onUpdateToken: (tokenId: string, updater: (token: TokenInstance) => TokenInstance) => void
}

const abilityRows = [
  ['СИЛ', 'strength'],
  ['ЛОВ', 'dexterity'],
  ['ТЕЛ', 'constitution'],
  ['ИНТ', 'intelligence'],
  ['МДР', 'wisdom'],
  ['ХАР', 'charisma'],
] as const

const featureSections: Array<{
  key: 'traits' | 'actions' | 'bonusActions' | 'reactions' | 'legendaryActions'
  title: string
}> = [
  { key: 'traits', title: 'Черты' },
  { key: 'actions', title: 'Действия' },
  { key: 'bonusActions', title: 'Бонусные действия' },
  { key: 'reactions', title: 'Реакции' },
  { key: 'legendaryActions', title: 'Легендарные действия' },
]

const characterAbilityLabels: Record<string, string> = {
  str: 'СИЛ',
  dex: 'ЛОВ',
  con: 'ТЕЛ',
  int: 'ИНТ',
  wis: 'МДР',
  cha: 'ХАР',
}

const conditionOptions = [
  {
    id: 'blinded',
    label: 'Ослеплён',
    description:
      'Не видит; проверки зрения проваливаются, атаки по нему с преимуществом, его атаки с помехой.',
    details: [
      'Существо не видит и автоматически проваливает проверки характеристик, требующие зрения.',
      'Броски атаки по существу совершаются с преимуществом, а его собственные броски атаки — с помехой.',
    ],
  },
  {
    id: 'charmed',
    label: 'Очарован',
    description: 'Не может атаковать очаровавшего; тот имеет преимущество на социальные проверки.',
    details: [
      'Очарованное существо не может атаковать очаровавшего и выбирать его целью вредоносных эффектов.',
      'Очаровавший получает преимущество на проверки характеристик для социального взаимодействия с целью.',
    ],
  },
  {
    id: 'deafened',
    label: 'Оглох',
    description: 'Не слышит; проверки слуха проваливаются.',
    details: [
      'Существо не слышит и автоматически проваливает проверки характеристик, требующие слуха.',
    ],
  },
  {
    id: 'frightened',
    label: 'Испуган',
    description:
      'Помеха на проверки и атаки, пока источник страха виден; нельзя добровольно приближаться.',
    details: [
      'Пока источник страха находится в линии обзора, существо совершает проверки характеристик и броски атаки с помехой.',
      'Существо не может добровольно приблизиться к источнику своего страха.',
    ],
  },
  {
    id: 'grappled',
    label: 'Схвачен',
    description: 'Скорость 0; состояние оканчивается, если хвататель больше не удерживает цель.',
    details: [
      'Скорость существа становится 0 и не может увеличиваться бонусами к скорости.',
      'Состояние заканчивается, если хвататель становится недееспособен или если эффект выводит цель из досягаемости хватателя.',
    ],
  },
  {
    id: 'incapacitated',
    label: 'Недееспособен',
    description: 'Не может совершать действия и реакции.',
    details: ['Существо не может совершать действия и реакции.'],
  },
  {
    id: 'invisible',
    label: 'Невидим',
    description:
      'Без магии или особых чувств его не видно; атаки по нему с помехой, его атаки с преимуществом.',
    details: [
      'Существо невозможно увидеть без помощи магии или особого чувства, но его местоположение может выдать шум или следы.',
      'Броски атаки по невидимому существу совершаются с помехой, а его собственные броски атаки — с преимуществом.',
    ],
  },
  {
    id: 'paralyzed',
    label: 'Парализован',
    description:
      'Недееспособен, не двигается и не говорит; проваливает Сил/Лов спасброски, атаки вблизи критуют.',
    details: [
      'Существо недееспособно, не может двигаться и говорить.',
      'Оно автоматически проваливает спасброски Силы и Ловкости.',
      'Броски атаки по нему совершаются с преимуществом, а попадание атакой в пределах 5 футов становится критическим.',
    ],
  },
  {
    id: 'petrified',
    label: 'Окаменел',
    description:
      'Преобразован в камень; недееспособен, сопротивляется всему урону, иммунен к ядам и болезням.',
    details: [
      'Существо вместе со всем немагическим снаряжением превращается в твёрдое вещество, обычно камень.',
      'Оно недееспособно, не двигается, не говорит и не осознаёт окружение.',
      'Оно получает сопротивление всему урону и иммунитет к яду и болезням.',
    ],
  },
  {
    id: 'poisoned',
    label: 'Отравлен',
    description: 'Помеха на броски атаки и проверки характеристик.',
    details: ['Существо совершает броски атаки и проверки характеристик с помехой.'],
  },
  {
    id: 'prone',
    label: 'Лежит ничком',
    description:
      'Можно только ползти; атаки вблизи по нему с преимуществом, дальние атаки с помехой.',
    details: [
      'Единственный способ перемещения без вставания — ползком.',
      'Существо совершает броски атаки с помехой.',
      'Атаки по нему с расстояния до 5 футов совершаются с преимуществом, остальные атаки — с помехой.',
    ],
  },
  {
    id: 'restrained',
    label: 'Опутан',
    description:
      'Скорость 0; атаки по нему с преимуществом, его атаки и Лов спасброски с помехой.',
    details: [
      'Скорость существа становится 0 и не может увеличиваться бонусами.',
      'Броски атаки по нему совершаются с преимуществом, а его собственные броски атаки — с помехой.',
      'Существо совершает спасброски Ловкости с помехой.',
    ],
  },
  {
    id: 'stunned',
    label: 'Ошеломлён',
    description:
      'Недееспособен, не двигается, говорит запинаясь; проваливает Сил/Лов спасброски.',
    details: [
      'Существо недееспособно, не может двигаться и говорит только запинаясь.',
      'Оно автоматически проваливает спасброски Силы и Ловкости.',
      'Броски атаки по нему совершаются с преимуществом.',
    ],
  },
  {
    id: 'unconscious',
    label: 'Без сознания',
    description:
      'Недееспособен, падает ничком, выпускает предметы; атаки рядом критуют при попадании.',
    details: [
      'Существо недееспособно, не может двигаться и говорить, не осознаёт окружение.',
      'Оно падает ничком и выпускает удерживаемые предметы.',
      'Оно автоматически проваливает спасброски Силы и Ловкости; атаки по нему совершаются с преимуществом.',
      'Попадание атакой в пределах 5 футов становится критическим.',
    ],
  },
  {
    id: 'exhaustion',
    label: 'Истощение',
    description: 'Накладывает накопительные штрафы по уровню истощения.',
    details: [
      'Истощение накапливается по уровням, и каждый уровень усиливает штрафы.',
      'Обычно уровни истощения снимаются отдыхом или специальными эффектами.',
    ],
  },
  {
    id: 'concentrated',
    label: 'Сконцентрированный',
    category: 'Прочие состояния',
    source: 'PHB',
    url: 'https://5e14.ttg.club/screens/concentrated',
    description: 'Поддерживает эффект, требующий концентрации; концентрация может быть потеряна от урона, смерти, недееспособности или нового концентрационного заклинания.',
    details: [
      'Нельзя концентрироваться на двух заклинаниях одновременно.',
      'При получении урона нужно пройти спасбросок Телосложения, чтобы сохранить концентрацию.',
      'Концентрация заканчивается при недееспособности или смерти.',
    ],
  },
  {
    id: 'madness',
    label: 'Безумный',
    category: 'Прочие состояния',
    source: 'PHB',
    url: 'https://5e14.ttg.club/screens/madness',
    description: 'Безумие может быть кратковременным, долговременным или бессрочным и накладывает поведенческие эффекты.',
    details: ['Кратковременное безумие обычно длится минуты.', 'Долговременное и бессрочное безумие требуют лечения, отдыха или магии по решению мастера.'],
  },
  {
    id: 'dodging',
    label: 'Уклоняющийся',
    category: 'Прочие состояния',
    source: 'PHB',
    url: 'https://5e14.ttg.club/screens/dodging',
    description: 'До начала следующего хода атаки по существу совершаются с помехой, а спасброски Ловкости — с преимуществом.',
    details: ['Эффект теряется, если существо становится недееспособным или его скорость падает до 0.'],
  },
  {
    id: 'stabilized',
    label: 'Стабилизированный',
    category: 'Прочие состояния',
    source: 'PHB',
    url: 'https://5e14.ttg.club/screens/stabilized',
    description: 'Существо с 0 хитов больше не совершает спасброски от смерти, но остаётся без сознания.',
    details: ['Если стабилизированное существо получает урон, оно снова начинает умирать.'],
  },
  {
    id: 'surprise',
    label: 'Захваченный врасплох',
    category: 'Прочие состояния',
    source: 'PHB',
    url: 'https://5e14.ttg.club/screens/surprise',
    description: 'Существо не готово к началу боя и ограничено в первый раунд столкновения.',
    details: ['Используется, когда одна сторона застала другую врасплох до начала боя.'],
  },
  {
    id: 'intoxicated',
    label: 'Опьяненный',
    category: 'Прочие состояния',
    source: 'TaT',
    url: 'https://5e14.ttg.club/screens/intoxicated',
    description: 'Опьянение измеряется степенями и накапливает эффекты по мере ухудшения состояния.',
    details: ['Существо с иммунитетом к состоянию Отравленный не может стать опьянённым.', 'Эффекты более низких степеней продолжают действовать вместе с текущей степенью.'],
  },
  {
    id: 'mindfire',
    label: 'Воспаление Разума',
    category: 'Болезни',
    source: 'PHB',
    url: 'https://5e14.ttg.club/screens/mindfire',
    description: 'Сознание существа лихорадит.',
    details: ['Существо совершает с помехой проверки и спасброски Интеллекта.', 'В бою ведёт себя так, будто находится под действием заклинания Смятение.'],
  },
  {
    id: 'sight_rot',
    label: 'Глазная Гниль',
    category: 'Болезни',
    source: 'PHB',
    url: 'https://5e14.ttg.club/screens/sight_rot',
    description: 'Болезненная инфекция заставляет глаза кровоточить и может привести к слепоте.',
    details: ['Даёт штраф к атакам и проверкам, полагающимся на зрение.', 'Штраф ухудшается после продолжительного отдыха, пока болезнь не вылечена.'],
  },
  {
    id: 'flesh_rot',
    label: 'Гниение Плоти',
    category: 'Болезни',
    source: 'PHB',
    url: 'https://5e14.ttg.club/screens/flesh_rot',
    description: 'Плоть существа начинает разлагаться.',
    details: ['Существо совершает с помехой проверки Харизмы.', 'Существо получает уязвимость ко всем видам урона.'],
  },
  {
    id: 'filth_feve',
    label: 'Грязевая Лихорадка',
    category: 'Болезни',
    source: 'PHB',
    url: 'https://5e14.ttg.club/screens/filth_feve',
    description: 'Болезнь вызывает жар, слабость и мешает телу сопротивляться нагрузкам.',
    details: ['Существо получает помеху на проверки и спасброски, связанные с физической выносливостью.', 'Лечится отдыхом, успешными спасбросками или магией, исцеляющей болезни.'],
  },
  {
    id: 'seizure',
    label: 'Припадок',
    category: 'Болезни',
    source: 'PHB',
    url: 'https://5e14.ttg.club/screens/seizure',
    description: 'Существо сотрясают приступы.',
    details: ['Существо совершает с помехой проверки и спасброски Ловкости, а также броски атаки, использующие Ловкость.'],
  },
  {
    id: 'slimy_doom',
    label: 'Склизкая Смерть',
    category: 'Болезни',
    source: 'PHB',
    url: 'https://5e14.ttg.club/screens/slimy_doom',
    description: 'Существо начинает неконтролируемо кровоточить.',
    details: ['Существо совершает с помехой проверки и спасброски Телосложения.', 'При получении урона существо ошеломляется до конца своего следующего хода.'],
  },
  {
    id: 'blinding_sickness',
    label: 'Слепотуха',
    category: 'Болезни',
    source: 'PHB',
    url: 'https://5e14.ttg.club/screens/blinding_sickness',
    description: 'Боль поражает разум и вызывает молочно-белую пелену в глазах.',
    details: ['Существо совершает с помехой проверки и спасброски Мудрости.', 'Существо считается ослеплённым.'],
  },
  {
    id: 'throat_leeches',
    label: 'Гортанные Пиявки',
    category: 'Болезни',
    source: 'TOA',
    url: 'https://5e14.ttg.club/screens/throat_leeches',
    description: 'Паразиты в горле мешают дышать, говорить и восстанавливаться.',
    details: ['Часто связаны с заражённой водой.', 'Могут мешать вербальным компонентам и отдыху по описанию эффекта.'],
  },
  {
    id: 'shivering_sickness',
    label: 'Дрожащая Болезнь',
    category: 'Болезни',
    source: 'TOA',
    url: 'https://5e14.ttg.club/screens/shivering_sickness',
    description: 'Болезнь вызывает сильную дрожь и слабость.',
    details: ['Симптомы мешают точным движениям и нормальному отдыху.', 'Лечится успешными спасбросками или магией, исцеляющей болезни.'],
  },
  {
    id: 'blue_mist_fever',
    label: 'Лихорадка синего тумана',
    category: 'Болезни',
    source: 'TOA',
    url: 'https://5e14.ttg.club/screens/blue_mist_fever',
    description: 'Лихорадка, связанная с воздействием синего тумана.',
    details: ['Накладывает симптомы болезни после заражения.', 'Подробные эффекты зависят от описания источника на TTG.'],
  },
  {
    id: 'sewer_plague',
    label: 'Сточная Чума',
    category: 'Болезни',
    source: 'DMG',
    url: 'https://5e14.ttg.club/screens/sewer_plague',
    description: 'Чума из сточных вод вызывает истощение и мешает восстановлению.',
    details: ['Передаётся через грязь, сточные воды и заражённых существ.', 'При провалах спасбросков может давать уровни истощения.'],
  },
  {
    id: 'cackle_fever',
    label: 'Хохочущая Лихорадка',
    category: 'Болезни',
    source: 'DMG',
    url: 'https://5e14.ttg.club/screens/cackle_fever',
    description: 'Болезнь вызывает приступы безумного смеха.',
    details: ['Может распространяться среди гуманоидов.', 'При симптомах существо теряет контроль и смеётся приступами.'],
  },
  {
    id: 'snow_blindness',
    label: 'Снежная слепота',
    category: 'Болезни',
    source: 'MHH',
    url: 'https://5e14.ttg.club/screens/snow_blindness',
    description: 'Слепота и боль в глазах от яркого снега и холода.',
    details: ['Мешает проверкам, зависящим от зрения.', 'Используется для суровых снежных условий.'],
  },
  {
    id: 'frostbite_and_hypothermia',
    label: 'Обморожение и переохлаждение',
    category: 'Болезни',
    source: 'MHH',
    url: 'https://5e14.ttg.club/screens/frostbite_and_hypothermia',
    description: 'Последствия сильного холода, которые ослабляют тело и могут быть смертельны.',
    details: ['Применяется при долгом воздействии низких температур.', 'Может снижать эффективность действий и восстановления.'],
  },
  {
    id: 'blue_rot',
    label: 'Синегниль',
    category: 'Болезни',
    source: 'GOS',
    url: 'https://5e14.ttg.club/screens/blue_rot',
    description: 'Болезнь поражает гуманоидов, вызывая синие фурункулы и потерю характеристик.',
    details: ['Обычно переносится нежитью.', 'Может снижать Телосложение и Харизму до исцеления.'],
  },
  {
    id: 'the_gnawing_plague',
    label: 'Грызучая чума',
    category: 'Болезни',
    source: 'VRGR',
    url: 'https://5e14.ttg.club/screens/the_gnawing_plague',
    description: 'Чума, передающаяся через крыс, веркрыс и физический контакт с заражёнными.',
    details: ['Даёт истощение и мешает восстановлению хитов.', 'В конце продолжительного отдыха существо проверяет, ухудшается ли болезнь или проходит.'],
  },
  {
    id: 'super-tetanus',
    label: 'Супер-столбняк',
    category: 'Болезни',
    source: 'TftYP',
    url: 'https://5e14.ttg.club/screens/super-tetanus',
    description: 'Болезнь вызывает мучительные спазмы и постоянный урон.',
    details: ['Существо получает урон в начале каждого своего хода.', 'Спасброски могут завершить заражение, если жертва не погибла.'],
  },
  {
    id: 'saprophytic_plague',
    label: 'Сапрофитная чума',
    category: 'Болезни',
    source: 'CM',
    url: 'https://5e14.ttg.club/screens/saprophytic_plague',
    description: 'Грибковая чума, распространяющаяся от заражённых существ и спор.',
    details: ['Даёт уровни истощения и прогрессирует со временем.', 'Может портить пищу и превращать погибших в пурпурную слизь.'],
  },
  {
    id: 'redface',
    label: 'Красноликость',
    category: 'Болезни',
    source: 'GoS',
    url: 'https://5e14.ttg.club/screens/redface',
    description: 'Эффекты похожи на глазную гниль, но болезнь вызвана загрязнённым воздухом.',
    details: ['Сложнее предотвращается, потому что распространяется через воздух.'],
  },
  {
    id: 'grackle-lung',
    label: 'Гракл-Лунг',
    category: 'Болезни',
    source: 'OotA',
    url: 'https://5e14.ttg.club/screens/grackle-lung',
    description: 'Болезнь лёгких от постоянного смога, вызывающая кашель, мокроту и истощение.',
    details: ['Мешает рывку и вербальным компонентам.', 'Может давать уровни истощения после продолжительного отдыха.'],
  },
  {
    id: 'frigid_woe',
    label: 'Холодное горе',
    category: 'Болезни',
    source: 'EGtW',
    url: 'https://5e14.ttg.club/screens/frigid_woe',
    description: 'Магическая болезнь Эора, которую нельзя вылечить обычными методами.',
    details: ['Постепенно снижает скорость заражённого существа.', 'Нужен особый антидот; обычная магия лечения болезней не помогает.'],
  },
  {
    id: 'arcane_blight',
    label: 'Магическая зараза',
    category: 'Болезни',
    source: 'IDRotF',
    url: 'https://5e14.ttg.club/screens/arcane_blight',
    description: 'Магическая болезнь, вызывающая паранойю, галлюцинации и опасную трансформацию.',
    details: ['После серии провалов может превратить гуманоида в нотика.', 'Сильная магия может снять симптомы, но не даёт защиты от нового заражения.'],
  },
  {
    id: 'contamination',
    label: 'Контаминация',
    category: 'Болезни',
    source: 'DoDk',
    url: 'https://5e14.ttg.club/screens/contamination',
    description: 'Заражение мистической радиацией и загрязнителями, измеряемое уровнями.',
    details: ['Уровни контаминации дают симптомы и могут вызывать мутации.', 'На высоких уровнях возможна монструозная трансформация.'],
  },
  {
    id: 'lycanthropes',
    label: 'Ликантропия',
    category: 'Проклятия',
    source: 'MM',
    url: 'https://5e14.ttg.club/screens/lycanthropes',
    description: 'Проклятие оборотня, меняющее природу существа и дающее звериную форму.',
    details: ['Может передаваться через укус ликантропа.', 'Мировоззрение и контроль над персонажем могут измениться по решению мастера.'],
  },
  {
    id: 'vampirism',
    label: 'Вампиризм',
    category: 'Проклятия',
    source: 'MM',
    url: 'https://5e14.ttg.club/screens/vampirism',
    description: 'Проклятие вампира, превращающее существо в нежить с вампирскими чертами.',
    details: ['Меняет природу, характеристики и особенности персонажа.', 'Может потребовать Wish, смерти и воскрешения или другого особого решения мастера.'],
  },
] as const

const conditionCategoryOrder = ['Состояния', 'Прочие состояния', 'Болезни', 'Проклятия'] as const

const conditionById: ReadonlyMap<string, (typeof conditionOptions)[number]> = new Map(
  conditionOptions.map((condition) => [condition.id, condition]),
)

function getConditionCategory(condition: (typeof conditionOptions)[number]) {
  const category = 'category' in condition ? condition.category : ''

  return typeof category === 'string' && category ? category : 'Состояния'
}

function getConditionSource(condition: (typeof conditionOptions)[number]) {
  const source = 'source' in condition ? condition.source : ''

  return typeof source === 'string' && source ? source : 'PHB'
}

function getConditionUrl(condition: (typeof conditionOptions)[number]) {
  const url = 'url' in condition ? condition.url : ''

  return typeof url === 'string' && url
    ? url
    : 'https://5e14.ttg.club/screens/conditions_and_disease'
}

function getConditionEnglish(condition: (typeof conditionOptions)[number]) {
  const english = 'english' in condition ? condition.english : ''

  return typeof english === 'string' && english ? english : ''
}

function parseHitPointsValue(hitPoints: string) {
  const match = hitPoints.match(/\d+/)

  return match ? Number(match[0]) : null
}

function formatModifier(score: number) {
  const modifier = Math.floor((score - 10) / 2)

  return modifier >= 0 ? `+${modifier}` : String(modifier)
}

function getTokenSpaceFromMonsterSize(size: string): TokenSpace {
  const normalizedSize = size.toLocaleLowerCase('ru-RU')

  if (normalizedSize.includes('мал')) {
    return 'small'
  }

  if (normalizedSize.includes('больш')) {
    return 'large'
  }

  if (normalizedSize.includes('огром') || normalizedSize.includes('гигант')) {
    return 'huge'
  }

  return 'medium'
}

function applyMonsterToToken(token: TokenInstance, monster: MonsterBlock): TokenInstance {
  const hitPointsMax = parseHitPointsValue(monster.hitPoints)

  return {
    ...token,
    kind: 'monster',
    linkedMonsterId: monster.id,
    linkedCharacterId: null,
    name: monster.name || token.name,
    imageSrc: monster.imageSrc || token.imageSrc,
    space: getTokenSpaceFromMonsterSize(monster.size),
    hitPointsMax,
    hitPointsCurrent: hitPointsMax,
  }
}

function applyCharacterToToken(token: TokenInstance, character: PlayerCharacter): TokenInstance {
  return {
    ...token,
    kind: 'player',
    linkedMonsterId: null,
    linkedCharacterId: character.id,
    groupLabel: null,
    name: character.name || token.name,
    imageSrc: character.avatarSrc || token.imageSrc,
    space: 'medium',
    hitPointsMax: character.hpMax,
    hitPointsCurrent: character.hpCurrent ?? character.hpMax,
    initiative: character.initiative,
  }
}

function formatSigned(value: number | null | undefined) {
  if (value == null) {
    return '—'
  }

  return value >= 0 ? `+${value}` : String(value)
}

function formatNumber(value: number | null | undefined) {
  return value ?? '—'
}

function isFilled(value: string | null | undefined) {
  return Boolean(value?.trim())
}

function getTokenConditions(token: TokenInstance) {
  return (token.conditions ?? []).filter((conditionId) => conditionById.has(conditionId))
}

const resetTokenDefaults: Record<TokenKind, { name: string; color: string; label: string }> = {
  player: { name: 'Игрок', color: '#4f6f3a', label: 'И' },
  monster: { name: 'Монстр', color: '#5b2f22', label: 'М' },
  npc: { name: 'NPC', color: '#6f5e39', label: 'N' },
}

function createResetTokenImage(kind: TokenKind) {
  const defaults = resetTokenDefaults[kind]
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <rect width="128" height="128" rx="28" fill="${defaults.color}" />
      <circle cx="64" cy="46" r="22" fill="#fff6e8" opacity="0.88" />
      <path d="M28 110c5-22 19-34 36-34s31 12 36 34" fill="#fff6e8" opacity="0.88" />
      <text x="64" y="73" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="${defaults.color}">${defaults.label}</text>
    </svg>
  `

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function resetTokenForKind(token: TokenInstance, kind: TokenKind): TokenInstance {
  const defaults = resetTokenDefaults[kind]

  return {
    ...token,
    kind,
    linkedMonsterId: null,
    linkedCharacterId: null,
    groupLabel: kind === 'player' ? null : '',
    name: defaults.name,
    imageSrc: createResetTokenImage(kind),
    space: 'medium',
    rotation: 0,
    hitPointsCurrent: null,
    hitPointsMax: null,
    initiative: null,
    conditions: [],
  }
}

function MonsterInfoLine({ label, value }: { label: string; value: string | null | undefined }) {
  if (!isFilled(value)) {
    return null
  }

  return (
    <p className={styles.monsterInfoLine}>
      <strong>{label}</strong> {value}
    </p>
  )
}

function MonsterFeatureList({ features }: { features: MonsterFeature[] }) {
  if (features.length === 0) {
    return null
  }

  return (
    <div className={styles.monsterFeatureList}>
      {features.map((feature) => (
        <p className={styles.monsterFeature} key={feature.id}>
          <strong>{feature.title}</strong>
          {feature.body ? ` ${feature.body}` : ''}
        </p>
      ))}
    </div>
  )
}

function TokenConditionBadges({
  token,
  onOpenCondition,
  onRemoveCondition,
}: {
  token: TokenInstance
  onOpenCondition: (conditionId: string) => void
  onRemoveCondition: (conditionId: string) => void
}) {
  const tokenConditions = getTokenConditions(token)

  if (tokenConditions.length === 0) {
    return <div className={styles.conditionShelf} aria-label="Состояния фишки" />
  }

  return (
    <div className={styles.conditionShelf} aria-label="Состояния фишки">
      {tokenConditions.map((conditionId) => {
        const condition = conditionById.get(conditionId)

        if (!condition) {
          return null
        }

        return (
          <div
            className={styles.conditionBadge}
            data-tooltip={condition.description}
            key={condition.id}
          >
            <button
              className={styles.conditionBadgeInfo}
              onClick={() => onOpenCondition(condition.id)}
              type="button"
            >
              {condition.label}
            </button>
            <button
              aria-label={`Снять состояние ${condition.label}`}
              className={styles.conditionBadgeRemove}
              onClick={() => onRemoveCondition(condition.id)}
              type="button"
            >
              <i aria-hidden="true" className="fa-solid fa-xmark" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function ConditionDetailsModal({
  condition,
  onClose,
}: {
  condition: (typeof conditionOptions)[number]
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        aria-label={`Состояние ${condition.label}`}
        aria-modal="true"
        className={`modal-dialog ${styles.conditionModal}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className={styles.conditionModalHeader}>
          <div>
            <span className="eyebrow">
              {getConditionCategory(condition)} · {getConditionSource(condition)}
            </span>
            <h3>{condition.label}</h3>
            {getConditionEnglish(condition) ? (
              <p>{getConditionEnglish(condition)}</p>
            ) : null}
          </div>
          <button
            aria-label="Закрыть"
            className="ghost-button compact-button token-modal-icon-button"
            onClick={onClose}
            type="button"
          >
            <i aria-hidden="true" className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className={styles.conditionModalBody}>
          <p>{condition.description}</p>
          <ul>
            {condition.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
          <a
            href={getConditionUrl(condition)}
            rel="noreferrer"
            target="_blank"
          >
            Открыть на TTG Club
          </a>
        </div>
      </div>
    </div>
  )
}

function MonsterPreviewCard({
  monster,
  token,
  onOpenCondition,
  onRemoveCondition,
}: {
  monster: MonsterBlock
  token: TokenInstance
  onOpenCondition: (conditionId: string) => void
  onRemoveCondition: (conditionId: string) => void
}) {
  const subtitleParts = [monster.subtitle].filter(isFilled)
  const hasDefense =
    isFilled(monster.armorClass) || isFilled(monster.hitPoints) || isFilled(monster.speed)
  const hasProfile =
    isFilled(monster.savingThrows) ||
    isFilled(monster.skills) ||
    isFilled(monster.damageVulnerabilities) ||
    isFilled(monster.damageResistances) ||
    isFilled(monster.damageImmunities) ||
    isFilled(monster.conditionImmunities) ||
    isFilled(monster.senses) ||
    isFilled(monster.languages) ||
    isFilled(monster.challenge) ||
    isFilled(monster.proficiencyBonus)
  const hasAnyFeature = featureSections.some((section) => monster[section.key].length > 0)

  return (
    <article className={styles.monsterPreview}>
      <div className={styles.monsterPreviewHeader}>
        <div className={styles.monsterPreviewTitle}>
          <h3>{monster.name}</h3>
          {subtitleParts.length > 0 ? <p>{subtitleParts.join(', ')}</p> : null}
        </div>
        <div className={styles.monsterPreviewMeta}>
          {isFilled(monster.source) ? (
            <span className={styles.monsterSource}>Источник: {monster.source}</span>
          ) : null}
          <TokenConditionBadges
            token={token}
            onOpenCondition={onOpenCondition}
            onRemoveCondition={onRemoveCondition}
          />
        </div>
      </div>

      <div className={styles.monsterPreviewBody}>
        <div className={styles.monsterPreviewMain}>
          {hasDefense ? (
            <div className={styles.monsterInfoBlock}>
              <MonsterInfoLine label="Класс доспеха" value={monster.armorClass} />
              <MonsterInfoLine label="Хиты" value={monster.hitPoints} />
              <MonsterInfoLine label="Скорость" value={monster.speed} />
            </div>
          ) : null}

          <div className={styles.monsterAbilityGrid}>
            {abilityRows.map(([label, key]) => {
              const score = monster[key]

              return (
                <div className={styles.monsterAbility} key={key}>
                  <strong>{label}</strong>
                  <span>
                    {score} ({formatModifier(score)})
                  </span>
                </div>
              )
            })}
          </div>

          {hasProfile ? (
            <div className={styles.monsterInfoBlock}>
              <MonsterInfoLine label="Спасброски" value={monster.savingThrows} />
              <MonsterInfoLine label="Навыки" value={monster.skills} />
              <MonsterInfoLine label="Уязвимость к урону" value={monster.damageVulnerabilities} />
              <MonsterInfoLine label="Сопротивление урону" value={monster.damageResistances} />
              <MonsterInfoLine label="Иммунитет к урону" value={monster.damageImmunities} />
              <MonsterInfoLine label="Иммунитет к состояниям" value={monster.conditionImmunities} />
              <MonsterInfoLine label="Чувства" value={monster.senses} />
              <MonsterInfoLine label="Языки" value={monster.languages} />
              <MonsterInfoLine label="Уровень опасности" value={monster.challenge} />
              <MonsterInfoLine label="Бонус мастерства" value={monster.proficiencyBonus} />
            </div>
          ) : null}
        </div>

        {monster.imageSrc ? (
          <img className={styles.monsterPortrait} alt={monster.name} src={monster.imageSrc} />
        ) : null}
      </div>

      {isFilled(monster.notes) ? <p className={styles.monsterNotes}>{monster.notes}</p> : null}

      {hasAnyFeature ? (
        <div className={styles.monsterSections}>
          {featureSections.map((section) =>
            monster[section.key].length > 0 ? (
              <section className={styles.monsterSection} key={section.key}>
                <h4>{section.title}</h4>
                <MonsterFeatureList features={monster[section.key]} />
              </section>
            ) : null,
          )}
        </div>
      ) : null}
    </article>
  )
}

function CharacterPreviewCard({
  character,
  token,
  onOpenCharacter,
  onOpenCondition,
  onRemoveCondition,
}: {
  character: PlayerCharacter
  token: TokenInstance
  onOpenCharacter: () => void
  onOpenCondition: (conditionId: string) => void
  onRemoveCondition: (conditionId: string) => void
}) {
  const stats = [
    ['КД', character.armorClass],
    ['ХП', `${formatNumber(token.hitPointsCurrent)} / ${formatNumber(token.hitPointsMax)}`],
    ['Скорость', character.speed],
    ['БМ', formatSigned(character.proficiencyBonus)],
    ['Иниц.', formatSigned(token.initiative ?? character.initiative)],
  ] as const
  const subtitle = [character.race, character.className, character.level ? `${character.level} ур.` : '']
    .filter(Boolean)
    .join(' • ')
  const passiveChecks = character.passiveSenses.length > 0 ? character.passiveSenses : character.skills.slice(0, 3)

  return (
    <article className={styles.characterPreview}>
      <div className={styles.characterPreviewHeader}>
        {character.avatarSrc ? (
          <img alt="" className={styles.characterPortrait} src={character.avatarSrc} />
        ) : (
          <span className={styles.characterPortraitPlaceholder}>
            {character.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className={styles.characterPreviewTitle}>
          <div className={styles.characterTitleRow}>
            <h3>{character.name}</h3>
            <button
              aria-label="Открыть карточку персонажа"
              className={styles.characterOpenButton}
              onClick={onOpenCharacter}
              title="Открыть карточку персонажа"
              type="button"
            >
              <i aria-hidden="true" className="fa-solid fa-id-card" />
            </button>
          </div>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className={styles.characterPreviewActions}>
          <TokenConditionBadges
            token={token}
            onOpenCondition={onOpenCondition}
            onRemoveCondition={onRemoveCondition}
          />
        </div>
      </div>

      <div className={styles.characterStatGrid}>
        {stats.map(([label, value]) => (
          <div className={styles.characterStat} key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <section className={styles.characterPreviewSection}>
        <h4>Пассивные проверки</h4>
        <div className={styles.characterPassiveGrid}>
          {passiveChecks.map((skill) => (
            <div className={styles.characterPassive} key={skill.id}>
              <span>{skill.label}</span>
              <strong>{10 + skill.modifier}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.characterPreviewSection}>
        <h4>Характеристики</h4>
        <div className={styles.characterAbilityGrid}>
          {character.stats.map((stat) => (
            <div className={styles.characterAbility} key={stat.id}>
              <span>{characterAbilityLabels[stat.id] ?? stat.label}</span>
              <strong>{stat.score}</strong>
              <em>{formatSigned(stat.modifier)}</em>
            </div>
          ))}
        </div>
      </section>
    </article>
  )
}

export function TokenModal({
  activeScene,
  characters,
  linkedCharacter,
  linkedMonster,
  token,
  onClose,
  onFocusLinkedCharacter,
  onFocusLinkedMonster,
  onRemoveToken,
  onReplaceTokenImage,
  onUpdateToken,
}: TokenModalProps) {
  const [selectedConditionId, setSelectedConditionId] = useState<string | null>(null)
  const isMonsterToken = token.kind === 'monster'
  const isPlayerToken = token.kind === 'player'
  const monsterCardLabel = 'Открыть монстра'
  const selectedCondition = selectedConditionId ? conditionById.get(selectedConditionId) ?? null : null

  const removeTokenCondition = (conditionId: string) => {
    onUpdateToken(token.id, (currentToken) => ({
      ...currentToken,
      conditions: getTokenConditions(currentToken).filter(
        (currentConditionId) => currentConditionId !== conditionId,
      ),
    }))

    if (selectedConditionId === conditionId) {
      setSelectedConditionId(null)
    }
  }

  const updateTokenKind = (kind: TokenKind) => {
    onUpdateToken(token.id, (currentToken) => resetTokenForKind(currentToken, kind))
  }

  const updateLinkedMonster = (monsterId: string) => {
    const selectedMonster = activeScene?.monsterBlocks.find((monster) => monster.id === monsterId) ?? null

    onUpdateToken(token.id, (currentToken) => {
      if (!selectedMonster) {
        return {
          ...currentToken,
          kind: monsterId ? 'monster' : currentToken.kind,
          linkedMonsterId: monsterId || null,
          linkedCharacterId: null,
        }
      }

      return applyMonsterToToken(currentToken, selectedMonster)
    })
  }

  const updateLinkedCharacter = (characterId: string) => {
    const selectedCharacter = characters.find((character) => character.id === characterId) ?? null

    onUpdateToken(token.id, (currentToken) => {
      if (!selectedCharacter) {
        return {
          ...currentToken,
          kind: 'player',
          linkedMonsterId: null,
          linkedCharacterId: null,
          groupLabel: null,
          space: 'medium',
        }
      }

      return applyCharacterToToken(currentToken, selectedCharacter)
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        aria-label="Редактор фишки"
        aria-modal="true"
        className="modal-dialog token-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-header">
          <div className="control-group-copy">
            <span className="eyebrow">Фишка</span>
            <p className="editor-hint">
              Меняй вид, тип и параметры фишки прямо перед показом игрокам.
            </p>
          </div>
          <button
            aria-label="Закрыть"
            className="ghost-button compact-button token-modal-icon-button"
            onClick={onClose}
            title="Закрыть"
            type="button"
          >
            <i aria-hidden="true" className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="editor-stack">
          {isMonsterToken ? (
            <div className={styles.monsterTokenControls}>
              <label className="field">
                <span>Тип</span>
                <StyledSelect
                  onChange={(event) => updateTokenKind(event.target.value as TokenKind)}
                  value={token.kind}
                >
                  <option value="player">Игрок</option>
                  <option value="monster">Монстр</option>
                  <option value="npc">NPC</option>
                </StyledSelect>
              </label>

              {activeScene ? (
                <label className="field">
                  <span>Связанный монстр</span>
                  <StyledSelect
                    onChange={(event) => updateLinkedMonster(event.target.value)}
                    value={token.linkedMonsterId ?? ''}
                  >
                    <option value="">Не выбран</option>
                    {activeScene.monsterBlocks.map((monster) => (
                      <option key={monster.id} value={monster.id}>
                        {monster.name}
                      </option>
                    ))}
                  </StyledSelect>
                </label>
              ) : null}
            </div>
          ) : isPlayerToken ? (
            <div className={styles.playerTokenControls}>
              <label className="field">
                <span>Тип</span>
                <StyledSelect
                  onChange={(event) => updateTokenKind(event.target.value as TokenKind)}
                  value={token.kind}
                >
                  <option value="player">Игрок</option>
                  <option value="monster">Монстр</option>
                  <option value="npc">NPC</option>
                </StyledSelect>
              </label>

              <label className="field">
                <span>Связанный персонаж</span>
                <StyledSelect
                  onChange={(event) => updateLinkedCharacter(event.target.value)}
                  value={token.linkedCharacterId ?? ''}
                >
                  <option value="">Не выбран</option>
                  {characters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name}
                    </option>
                  ))}
                </StyledSelect>
              </label>
            </div>
          ) : (
            <div className={styles.hero}>
              <div className={styles.imageUpload}>
                <label className={styles.imagePicker}>
                  <div className={styles.imagePreview}>
                    <img alt={token.name} src={token.imageSrc} />
                    <div className="token-image-overlay">
                      <i aria-hidden="true" className="fa-solid fa-upload" />
                    </div>
                  </div>
                  <input
                    accept="image/*"
                    className="token-image-input"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      void onReplaceTokenImage(token.id, file)
                      event.target.value = ''
                    }}
                    type="file"
                  />
                </label>
              </div>

              <div className={styles.heroFields}>
                <label className="field">
                  <span>Тип</span>
                  <StyledSelect
                    onChange={(event) => updateTokenKind(event.target.value as TokenKind)}
                    value={token.kind}
                  >
                    <option value="player">Игрок</option>
                    <option value="monster">Монстр</option>
                    <option value="npc">NPC</option>
                  </StyledSelect>
                </label>

                <label className="field">
                  <span>Группа</span>
                  <input
                    onChange={(event) =>
                      onUpdateToken(token.id, (currentToken) => ({
                        ...currentToken,
                        groupLabel: event.target.value || null,
                      }))
                    }
                    placeholder="Например, волки теней"
                    value={token.groupLabel ?? ''}
                  />
                </label>

              </div>
            </div>
          )}

          {isMonsterToken ? (
            <>
              {linkedMonster ? (
                <MonsterPreviewCard
                  monster={linkedMonster}
                  token={token}
                  onOpenCondition={setSelectedConditionId}
                  onRemoveCondition={removeTokenCondition}
                />
              ) : (
                <p className="editor-empty">Выбери монстра сцены, чтобы показать его карточку.</p>
              )}

              <TokenStatsFields token={token} onUpdateToken={onUpdateToken} />
            </>
          ) : isPlayerToken ? (
            <>
              {linkedCharacter ? (
                <>
                  <CharacterPreviewCard
                    character={linkedCharacter}
                    token={token}
                    onOpenCharacter={() => onFocusLinkedCharacter(linkedCharacter.id)}
                    onOpenCondition={setSelectedConditionId}
                    onRemoveCondition={removeTokenCondition}
                  />

                  <TokenStatsFields
                    showMaxHitPoints={false}
                    token={token}
                    onUpdateToken={onUpdateToken}
                  />
                </>
              ) : null}
            </>
          ) : (
            <>
              <label className="field">
                <span>Имя</span>
                <input
                  onChange={(event) =>
                    onUpdateToken(token.id, (currentToken) => ({
                      ...currentToken,
                      name: event.target.value,
                    }))
                  }
                  value={token.name}
                />
              </label>

              <label className="field">
                <span>Пространство</span>
                <StyledSelect
                  onChange={(event) =>
                    onUpdateToken(token.id, (currentToken) => ({
                      ...currentToken,
                      space: event.target.value as TokenSpace,
                    }))
                  }
                  value={token.space}
                >
                  {tokenSpaceValues.map((space) => (
                    <option key={space} value={space}>
                      {tokenSpaceLabels[space]}
                    </option>
                  ))}
                </StyledSelect>
              </label>

              <TokenStatsFields token={token} onUpdateToken={onUpdateToken} />
            </>
          )}

          <div className="action-row zone-action-row">
            {isMonsterToken ? (
              <button
                aria-label={monsterCardLabel}
                className="ghost-button compact-button token-modal-icon-button"
                disabled={!linkedMonster}
                onClick={() => onFocusLinkedMonster(token)}
                title={monsterCardLabel}
                type="button"
              >
                <i aria-hidden="true" className="fa-solid fa-id-card" />
              </button>
            ) : null}
            <button
              aria-label="Удалить фишку"
              className="ghost-button compact-button token-modal-icon-button"
              onClick={() => onRemoveToken(token.id)}
              title="Удалить фишку"
              type="button"
            >
              <i aria-hidden="true" className="fa-solid fa-trash" />
            </button>
          </div>
        </div>
      </div>
      {selectedCondition ? (
        <ConditionDetailsModal
          condition={selectedCondition}
          onClose={() => setSelectedConditionId(null)}
        />
      ) : null}
    </div>
  )
}

function TokenLayerControls({
  token,
  onUpdateToken,
}: {
  token: TokenInstance
  onUpdateToken: (tokenId: string, updater: (token: TokenInstance) => TokenInstance) => void
}) {
  return (
    <>
      <label className={`field ${styles.layerField}`}>
        <span>Порядок слоя</span>
        <input
          onChange={(event) =>
            onUpdateToken(token.id, (currentToken) => ({
              ...currentToken,
              zIndex: Number(event.target.value),
            }))
          }
          type="number"
          value={token.zIndex}
        />
      </label>
      <button
        aria-label="Ниже"
        className="ghost-button compact-button token-modal-icon-button"
        onClick={() =>
          onUpdateToken(token.id, (currentToken) => ({
            ...currentToken,
            zIndex: currentToken.zIndex - 1,
          }))
        }
        title="Ниже"
        type="button"
      >
        <i aria-hidden="true" className="fa-solid fa-arrow-down" />
      </button>
      <button
        aria-label="Выше"
        className="ghost-button compact-button token-modal-icon-button"
        onClick={() =>
          onUpdateToken(token.id, (currentToken) => ({
            ...currentToken,
            zIndex: currentToken.zIndex + 1,
          }))
        }
        title="Выше"
        type="button"
      >
        <i aria-hidden="true" className="fa-solid fa-arrow-up" />
      </button>
      <button
        aria-label={token.hiddenFromPlayers ? 'Фишка скрыта от игроков' : 'Фишка видима игрокам'}
        className={`ghost-button compact-button token-modal-icon-button ${styles.visibilityToggle}`}
        onClick={() =>
          onUpdateToken(token.id, (currentToken) => ({
            ...currentToken,
            hiddenFromPlayers: !currentToken.hiddenFromPlayers,
          }))
        }
        title={token.hiddenFromPlayers ? 'Фишка скрыта от игроков' : 'Фишка видима игрокам'}
        type="button"
      >
        <i aria-hidden="true" className={`fa-solid ${token.hiddenFromPlayers ? 'fa-eye-slash' : 'fa-eye'}`} />
      </button>
    </>
  )
}

function TokenStatsFields({
  token,
  showMaxHitPoints = true,
  onUpdateToken,
}: {
  token: TokenInstance
  showMaxHitPoints?: boolean
  onUpdateToken: (tokenId: string, updater: (token: TokenInstance) => TokenInstance) => void
}) {
  const tokenConditions = getTokenConditions(token)
  const availableConditions = conditionOptions.filter(
    (condition) => !tokenConditions.includes(condition.id),
  )

  return (
    <div className="zone-grid">
      <label className="field">
        <span>Текущие ХП</span>
        <input
          onChange={(event) =>
            onUpdateToken(token.id, (currentToken) => ({
              ...currentToken,
              hitPointsCurrent: event.target.value ? Number(event.target.value) : null,
            }))
          }
          type="number"
          value={token.hitPointsCurrent ?? ''}
        />
      </label>
      {showMaxHitPoints ? (
        <label className="field">
          <span>Макс. ХП</span>
          <input
            onChange={(event) =>
              onUpdateToken(token.id, (currentToken) => ({
                ...currentToken,
                hitPointsMax: event.target.value ? Number(event.target.value) : null,
              }))
            }
            type="number"
            value={token.hitPointsMax ?? ''}
          />
        </label>
      ) : null}
      <label className="field">
        <span>Инициатива</span>
        <input
          onChange={(event) =>
            onUpdateToken(token.id, (currentToken) => ({
              ...currentToken,
              initiative: event.target.value ? Number(event.target.value) : null,
            }))
          }
          type="number"
          value={token.initiative ?? ''}
        />
      </label>
      <label className={`field ${styles.conditionField}`}>
        <span>Состояния</span>
        <StyledSelect
          onChange={(event) => {
            const conditionId = event.target.value

            if (!conditionId) {
              return
            }

            onUpdateToken(token.id, (currentToken) => {
              const currentConditions = getTokenConditions(currentToken)

              return {
                ...currentToken,
                conditions: currentConditions.includes(conditionId)
                  ? currentConditions
                  : [...currentConditions, conditionId],
              }
            })
          }}
          value=""
        >
          <option value="">Добавить состояние</option>
          {conditionCategoryOrder.flatMap((category) => {
            const categoryConditions = availableConditions.filter(
              (condition) => getConditionCategory(condition) === category,
            )

            if (categoryConditions.length === 0) {
              return []
            }

            return [
              <option disabled key={`${category}-heading`} value={`__${category}`}>
                {category}
              </option>,
              ...categoryConditions.map((condition) => (
                <option key={condition.id} value={condition.id}>
                  {condition.label}
                </option>
              )),
            ]
          })}
        </StyledSelect>
      </label>
      <TokenLayerControls token={token} onUpdateToken={onUpdateToken} />
    </div>
  )
}

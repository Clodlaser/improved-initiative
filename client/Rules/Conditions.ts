export const Conditions2014 = {
  Blinded: `<ul>
    <li>A blinded creature can’t see and automatically fails any ability check that requires sight.</li>
    <li>Attack rolls against the creature have advantage, and the creature’s Attack rolls have disadvantage.</li>
    </ul>`,
  Charmed: `<ul>
    <li>A charmed creature can’t Attack the charmer or target the charmer with harmful Abilities or magical effects.</li>
    <li>The charmer has advantage on any ability check to interact socially with the creature.</li>
    </ul>`,
  Concentrating: `<p>Some spells require you to maintain concentration in order to keep their magic active. If you lose concentration, such a spell ends.</p>
  <p>If a spell must be maintained with concentration, that fact appears in its Duration entry, and the spell specifies how long you can concentrate on it. You can end concentration at any time (no action required).</p>
  <p>Normal activity, such as moving and attacking, doesn't interfere with concentration. The following factors can break concentration:</p>
  <ul>
  <li><strong>Casting another spell that requires concentration.</strong> You lose concentration on a spell if you cast another spell that requires concentration. You can't concentrate on two spells at once.</li>
  <li><strong>Taking damage.</strong> Whenever you take damage while you are concentrating on a spell, you must make a Constitution saving throw to maintain your concentration. The DC equals 10 or half the damage you take, whichever number is higher. If you take damage from multiple sources, such as an arrow and a dragon's breath, you make a separate saving throw for each source of damage.</li>
  <li><strong>Being incapacitated or killed.</strong> You lose concentration on a spell if you are incapacitated or if you die.</li>
  </ul>
  <p>The DM might also decide that certain environmental phenomena, such as a wave crashing over you while you're on a storm-tossed ship, require you to succeed on a DC 10 Constitution saving throw to maintain concentration on a spell.</p>`,
  Deafened: `<ul>
    <li>A deafened creature can’t hear and automatically fails any ability check that requires hearing.</li>
    </ul>`,
  Frightened: `<ul>
    <li>A frightened creature has disadvantage on Ability Checks and Attack rolls while the source of its fear is within line of sight.</li>
    <li>The creature can’t willingly move closer to the source of its fear.</li>
    </ul>`,
  Grappled: `<ul>
    <li>A grappled creature’s speed becomes 0, and it can’t benefit from any bonus to its speed.</li>
    <li>The condition ends if the Grappler is incapacitated (see the condition).</li>
    <li>The condition also ends if an effect removes the grappled creature from the reach of the Grappler or Grappling effect, such as when a creature is hurled away by the Thunderwave spell.</li>
    </ul>`,
  Incapacitated: `<ul>
    <li>An incapacitated creature can’t take actions or reactions.</li>
    </ul>`,
  Invisible: `<ul>
    <li>An invisible creature is impossible to see without the aid of magic or a Special sense. For the purpose of Hiding, the creature is heavily obscured. The creature’s location can be detected by any noise it makes or any tracks it leaves.</li>
    <li>Attack rolls against the creature have disadvantage, and the creature’s Attack rolls have advantage.</li>
    </ul>`,
  Paralyzed: `<ul>
    <li>A paralyzed creature is incapacitated (see the condition) and can’t move or speak.</li>
    <li>The creature automatically fails Strength and Dexterity saving throws.</li>
    <li>Attack rolls against the creature have advantage.</li>
    <li>Any Attack that hits the creature is a critical hit if the attacker is within 5 feet of the creature.</li>
    </ul>`,
  Petrified: `<ul>
    <li>A petrified creature is transformed, along with any nonmagical object it is wearing or carrying, into a solid inanimate substance (usually stone). Its weight increases by a factor of ten, and it ceases aging.</li>
    <li>The creature is incapacitated (see the condition), can’t move or speak, and is unaware of its surroundings.</li>
    <li>Attack rolls against the creature have advantage.</li>
    <li>The creature automatically fails Strength and Dexterity saving throws.</li>
    <li>The creature has Resistance to all damage.</li>
    <li>The creature is immune to poison and disease, although a poison or disease already in its system is suspended, not neutralized.</li>
    </ul>`,
  Poisoned: `<ul>
    <li>A poisoned creature has disadvantage on Attack rolls and Ability Checks.</li>
    </ul>`,
  Prone: `<ul>
    <li>A prone creature’s only Movement option is to crawl, unless it stands up and thereby ends the condition.</li>
    <li>The creature has disadvantage on Attack rolls.</li>
    <li>An Attack roll against the creature has advantage if the attacker is within 5 feet of the creature. Otherwise, the Attack roll has disadvantage.</li>
    </ul>`,
  Restrained: `<ul>
    <li>A restrained creature’s speed becomes 0, and it can’t benefit from any bonus to its speed.</li>
    <li>Attack rolls against the creature have advantage, and the creature’s Attack rolls have disadvantage.</li>
    <li>The creature has disadvantage on Dexterity saving throws.</li>
    </ul>`,
  Stunned: `<ul>
    <li>A stunned creature is incapacitated (see the condition), can’t move, and can speak only falteringly.</li>
    <li>The creature automatically fails Strength and Dexterity saving throws.</li>
    <li>Attack rolls against the creature have advantage.</li>
    </ul>`,
  Unconscious: `<ul>
    <li>An unconscious creature is incapacitated (see the condition), can’t move or speak, and is unaware of its surroundings.</li>
    <li>The creature drops whatever it’s holding and falls prone.</li>
    <li>The creature automatically fails Strength and Dexterity saving throws.</li>
    <li>Attack rolls against the creature have advantage.</li>
    <li>Any Attack that hits the creature is a critical hit if the attacker is within 5 feet of the creature.</li>
    </ul>`,
  Exhaustion: `<p>Some special abilities and environmental hazards, such as starvation and the long-­term effects of freezing or scorching temperatures, can lead to a special condition called exhaustion. Exhaustion is measured in six levels. An effect can give a creature one or more levels of exhaustion, as specified in the effect’s description.</p>
    <p>Table: Exhaustion Effects</p>
    <p>Level	Effect <br />
    1	Disadvantage on ability checks <br />
    2	Speed halved <br />
    3	Disadvantage on attack rolls and saving throws <br />
    4	Hit point maximum halved <br />
    5	Speed reduced to 0 <br />
    6	Death </p>
    <p>If an already exhausted creature suffers another effect that causes exhaustion, its current level of exhaustion increases by the amount specified in the effect’s description. A creature suffers the effect of its current level of exhaustion as well as all lower levels. For example, a creature suffering level 2 exhaustion has its speed halved and has disadvantage on ability checks. An effect that removes exhaustion reduces its level as specified in the effect’s description, with all exhaustion effects ending if a creature’s exhaustion level is reduced below 1. Finishing a long rest reduces a creature’s exhaustion level by 1, provided that the creature has also ingested some food and drink.</p>`
};

export const Conditions2025 = {
  Blinded: `<p>
  While you have the Blinded condition, you experience the following effects.
</p>
<ul>
  <li>
    <strong>Can’t See.</strong> You can’t see and automatically fail any ability
    check that requires sight.
  </li>
  <li>
    <strong>Attacks Affected.</strong> Attack rolls against you have Advantage,
    and your attack rolls have Disadvantage.
  </li>
</ul>`,
  Charmed: `<p>
  While you have the Charmed condition, you experience the following effects.
</p>
<ul>
  <li>
    <strong>Can’t Harm the Charmer.</strong> You can’t attack the charmer or
    target the charmer with damaging abilities or magical effects.
  </li>
  <li>
    <strong>Social Advantage.</strong> The charmer has Advantage on any ability
    check to interact with you socially.
  </li>
</ul>`,
  Concentrating: `<p>
  Some spells and other effects require Concentration to remain active, as
  specified in their descriptions. If the effect’s creator loses Concentration,
  the effect ends. If the effect has a maximum duration, the effect’s
  description specifies how long the creator can concentrate on it: up to 1
  minute, 1 hour, or some other duration. The creator can end Concentration at
  any time (no action required). The following factors break Concentration.
</p>
<ul>
  <li>
    <strong>Another Concentration Effect.</strong> You lose Concentration on an
    effect the moment you start casting a spell that requires Concentration or
    activate another effect that requires Concentration.
  </li>
  <li>
    <strong>Damage.</strong> If you take damage, you must succeed on a
    Constitution saving throw to maintain Concentration. The DC equals 10 or
    half the damage taken (round down), whichever number is higher, up to a
    maximum DC of 30.
  </li>
  <li>
    <strong>Incapacitated or Dead.</strong> Your Concentration ends if you have
    the Incapacitated condition or you die.
  </li>
</ul>`,
  Deafened: `<p>
  While you have the Deafened condition, you experience the following effect.
</p>
<ul>
  <li>
    <strong>Can’t Hear.</strong> You can’t hear and automatically fail any
    ability check that requires hearing.
  </li>
</ul>`,
  Frightened: `<p>
  While you have the Frightened condition, you experience the following effects.
</p>
<ul>
  <li>
    <strong>Ability Checks and Attacks Affected.</strong> You have Disadvantage
    on ability checks and attack rolls while the source of fear is within line
    of sight.
  </li>
  <li>
    <strong>Can’t Approach.</strong> You can’t willingly move closer to the
    source of fear.
  </li>
</ul>`,
  Grappled: `<p>
  While you have the Grappled condition, you experience the following effects.
</p>
<ul>
  <li><strong>Speed 0.</strong> Your Speed is 0 and can’t increase.</li>
  <li>
    <strong>Attacks Affected.</strong> You have Disadvantage on attack rolls
    against any target other than the grappler.
  </li>
  <li>
    <strong>Movable.</strong> The grappler can drag or carry you when it moves,
    but every foot of movement costs it 1 extra foot unless you are Tiny or two
    or more sizes smaller than it.
  </li>
</ul>`,
  Incapacitated: `<p>
  While you have the Incapacitated condition, you experience the following
  effects.
</p>
<ul>
  <li>
    <strong>Inactive.</strong> You can’t take any action, Bonus Action, or
    Reaction.
  </li>
  <li><strong>No Concentration.</strong> Your Concentration is broken.</li>
  <li><strong>Speechless.</strong> You can’t speak.</li>
  <li>
    <strong>Surprised.</strong> If you’re Incapacitated when you roll
    Initiative, you have Disadvantage on the roll.
  </li>
</ul>`,
  Invisible: `<p>
  While you have the Invisible condition, you experience the following effects.
</p>
<ul>
  <li>
    <strong>Surprise.</strong> If you’re Invisible when you roll Initiative, you
    have Advantage on the roll.
  </li>
  <li>
    <strong>Concealed.</strong> You aren’t affected by any effect that requires
    its target to be seen unless the effect’s creator can somehow see you. Any
    equipment you are wearing or carrying is also concealed.
  </li>
  <li>
    <strong>Attacks Affected.</strong> Attack rolls against you have
    Disadvantage, and your attack rolls have Advantage. If a creature can
    somehow see you, you don’t gain this benefit against that creature.
  </li>
</ul>`,
  Paralyzed: `<p>
  While you have the Paralyzed condition, you experience the following effects.
</p>
<ul>
  <li><strong>Incapacitated.</strong> You have the Incapacitated condition.</li>
  <li><strong>Speed 0.</strong> Your Speed is 0 and can’t increase.</li>
  <li>
    <strong>Saving Throws Affected.</strong> You automatically fail Strength and
    Dexterity saving throws.
  </li>
  <li>
    <strong>Attacks Affected.</strong> Attack rolls against you have Advantage.
  </li>
  <li>
    <strong>Automatic Critical Hits.</strong> Any attack roll that hits you is a
    Critical Hit if the attacker is within 5 feet of you.
  </li>
</ul>`,
  Petrified: `<p>
  While you have the Petrified condition, you experience the following effects.
</p>
<ul>
  <li>
    <strong>Turned to Inanimate Substance.</strong> You are transformed, along
    with any nonmagical objects you are wearing and carrying, into a solid
    inanimate substance (usually stone). Your weight increases by a factor of
    ten, and you cease aging.
  </li>
  <li><strong>Incapacitated.</strong> You have the Incapacitated condition.</li>
  <li><strong>Speed 0.</strong> Your Speed is 0 and can’t increase.</li>
  <li>
    <strong>Attacks Affected.</strong> Attack rolls against you have Advantage.
  </li>
  <li>
    <strong>Saving Throws Affected.</strong> You automatically fail Strength and
    Dexterity saving throws.
  </li>
  <li><strong>Resist Damage.</strong> You have Resistance to all damage.</li>
  <li>
    <strong>Poison Immunity.</strong> You have Immunity to the Poisoned
    condition.
  </li>
</ul>`,
  Poisoned: `<p>
  While you have the Poisoned condition, you experience the following effect.
</p>
<ul>
  <li>
    <strong>Ability Checks and Attacks Affected.</strong> You have Disadvantage
    on attack rolls and ability checks.
  </li>
</ul>`,
  Prone: `<p>While you have the Prone condition, you experience the following effects.</p>
<ul>
  <li>
    <strong>Restricted Movement.</strong> Your only movement options are to
    crawl or to spend an amount of movement equal to half your Speed (round
    down) to right yourself and thereby end the condition. If your Speed is 0,
    you can’t right yourself.
  </li>
  <li>
    <strong>Attacks Affected.</strong> You have Disadvantage on attack rolls. An
    attack roll against you has Advantage if the attacker is within 5 feet of
    you. Otherwise, that attack roll has Disadvantage.
  </li>
</ul>`,
  Restrained: `<p>
  While you have the Restrained condition, you experience the following effects.
</p>
<ul>
  <li><strong>Speed 0.</strong> Your Speed is 0 and can’t increase.</li>
  <li>
    <strong>Attacks Affected.</strong> Attack rolls against you have Advantage,
    and your attack rolls have Disadvantage.
  </li>
  <li>
    <strong>Saving Throws Affected.</strong> You have Disadvantage on Dexterity
    saving throws.
  </li>
</ul>`,
  Stunned: `<p>
  While you have the Stunned condition, you experience the following effects.
</p>
<ul>
  <li><strong>Incapacitated.</strong> You have the Incapacitated condition.</li>
  <li>
    <strong>Saving Throws Affected.</strong> You automatically fail Strength and
    Dexterity saving throws.
  </li>
  <li>
    <strong>Attacks Affected.</strong> Attack rolls against you have Advantage.
  </li>
</ul>`,
  Unconscious: `<p>
  While you have the Unconscious condition, you experience the following
  effects.
</p>
<ul>
  <li>
    <strong>Inert.</strong> You have the Incapacitated and Prone conditions, and
    you drop whatever you’re holding. When this condition ends, you remain
    Prone.
  </li>
  <li><strong>Speed 0.</strong> Your Speed is 0 and can’t increase.</li>
  <li>
    <strong>Attacks Affected.</strong> Attack rolls against you have Advantage.
  </li>
  <li>
    <strong>Saving Throws Affected.</strong> You automatically fail Strength and
    Dexterity saving throws.
  </li>
  <li>
    <strong>Automatic Critical Hits.</strong> Any attack roll that hits you is a
    Critical Hit if the attacker is within 5 feet of you.
  </li>
  <li><strong>Unaware.</strong> You’re unaware of your surroundings.</li>
</ul>`,
  Exhaustion: `<p>
  While you have the Exhaustion condition, you experience the following effects.
</p>
<ul>
  <li>
    <strong>Exhaustion Levels.</strong> This condition is cumulative. Each time
    you receive it, you gain 1 Exhaustion level. You die if your Exhaustion
    level is 6.
  </li>
  <li>
    <strong>D20 Tests Affected.</strong> When you make a D20 Test, the roll is
    reduced by 2 times your Exhaustion level.
  </li>
  <li>
    <strong>Speed Reduced.</strong> Your Speed is reduced by a number of feet
    equal to 5 times your Exhaustion level.
  </li>
  <li>
    <strong>Removing Exhaustion Levels.</strong> Finishing a Long Rest removes 1
    of your Exhaustion levels. When your Exhaustion level reaches 0, the
    condition ends.
  </li>
</ul>`
};

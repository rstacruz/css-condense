Todo:
#### Options

   --no-definition-consolidation
   --no-selector-consolidation

#### Selector consolidation

    <= div { color: red } div { text-align: right }
    => div{color: red;text-align: right}

#### Duplicate properties

    <= div { color: red; color: blue ;}
    => div{color: blue}

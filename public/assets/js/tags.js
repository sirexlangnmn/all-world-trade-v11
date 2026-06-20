let tagInput;
let tagList;
let validationMessage;

tagInput = getId('tag-input');
tagList = getId('tag-list');
validationMessage = getId('validation-message');

// const tagInput = getId('tag-input');
// const tagList = getId('tag-list');
// const validationMessage = getId('validation-message');

let tagCount = 0;
const maxTags = 20;

function displayTagList(tagsData) {
    if (tagsData) {
        const tags = tagsData.split(',');

        // Add existing tags to the tag list
        for (let i = 0; i < tags.length; i++) {
            addTag(tags[i]);
        }
    }
}

// Add event listener to the input field
tagInput.addEventListener('input', () => {
    const tagsCount = tagList.children.length;
    if (tagsCount >= maxTags) {
        tagInput.disabled = true;
    } else {
        tagInput.disabled = false;
    }
});

// Add tag when the Enter key is pressed or the input loses focus
tagInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addTag(tagInput.value.trim());
    }
});

tagInput.addEventListener('blur', function (event) {
    addTag(tagInput.value.trim());
});

// Remove tag when x icon is clicked
tagList.addEventListener('click', function (event) {
    if (event.target.classList.contains('tag-delete')) {
        event.target.parentNode.remove();
        tagCount--;
        validationMessage.classList.add('hidden');
        tagInput.disabled = false;
        tagInput.focus();
        getTagList();
    }
});

// Add tag to the tag list
function addTag(tagValue) {
    if (tagValue === '') {
        return;
    }

    // const tagInput = document.getElementById('tag-input');
    // const tagList = document.getElementById('tag-list');
    // const validationMessage = document.getElementById('validation-message');

    if (tagCount >= maxTags) {
        validationMessage.classList.remove('hidden');
        tagInput.disabled = true;
        tagInput.value = '';
        return;
    }

    const tagElement = document.createElement('div');
    const tagText = document.createElement('span');
    const tagDelete = document.createElement('span');

    tagElement.classList.add(
        'flex',
        'items-center',
        'px-3',
        'py-1',
        'mb-2',
        'mr-2',
        'text-sm',
        'font-medium',
        'text-gray-700',
        'bg-gray-200',
        'rounded-lg',
    );
    tagText.classList.add('mr-2');
    tagText.textContent = tagValue;
    tagDelete.classList.add('text-xs', 'font-medium', 'text-gray-600', 'cursor-pointer', 'tag-delete');
    tagDelete.textContent = 'x';

    tagElement.appendChild(tagText);
    tagElement.appendChild(tagDelete);
    tagList.appendChild(tagElement);
    tagInput.value = '';
    tagCount++;

    getTagList();
}

function getTagList() {
    textAreaAddKeywords.value = '';
    const tagList = document.getElementById('tag-list');

    // Here, the regular expression /^[ \t\n]+|[ \t\n]+$/g matches any spaces ( ), tabs (\t), or line breaks (\n) that appear at the beginning of the string (^) or at the end of the string ($).
    // The | symbol in the middle of the regular expression specifies that either the leading or trailing spaces/line breaks should be matched.
    // By replacing these leading or trailing spaces/line breaks with an empty string,
    // this code will remove any extra spaces or line breaks on the left or right side of the text content while leaving intact the spaces between the sentences.
    let tagListValue = tagList.textContent.replaceAll('x', ',').replace(/^[ \t\n]+|[ \t\n]+$/g, '');

    // Remove the last character (which is a comma)
    tagListValue = tagListValue.slice(0, -1);
    // tagListValue will be the value of input field textAreaAddKeywords
    textAreaAddKeywords.value = tagListValue;
}

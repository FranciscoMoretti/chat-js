import { models } from "./models";
import { useSetModel, useView } from "./view";
export function ModelPicker() {
	const model = useView((s) => s.model);
	const setModel = useSetModel();
	return (
		<label>
			Model
			<select
				value={model}
				onChange={(event) => {
					const selected = models.find(
						(item) => item.id === event.target.value,
					);
					if (selected) setModel(selected.id);
				}}
			>
				{models.map((item) => (
					<option key={item.id} value={item.id}>
						{item.label}
					</option>
				))}
			</select>
		</label>
	);
}
